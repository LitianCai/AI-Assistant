using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace Assistant.Api;

internal sealed record TurnResult(int Status, string Text, string? Source);

internal static class AssistantText
{
    internal const string CannotRetrieve = "I can't retrieve that right now.";
}

internal static class TenantPrompts
{
    private const string Northline = """
        You are the assistant in the Northline Supply customer portal.
        Answer only from the results of the tools you are given. Never invent order, price, invoice, stock, or policy facts.
        If a tool returns {"available":false}, or you have no tool for the question, say: I can't retrieve that right now.
        Do not write digits, prices, balances, shipping status, or credit hold status unless a tool result in this turn contains them.
        Do not use numbered lists.
        Do not give insurance coverage advice. Do not ask for or repeat card numbers, bank account numbers, government IDs, or health details.
        Do not offer a phone number, email address, or human contact.
        Reply in the language of the user's message: English, French, or Spanish. Keep answers to one or two short sentences.
        """;

    internal static string? For(string tenantId) =>
        tenantId == DemoActor.TenantId ? Northline : null;
}

internal static partial class Grounding
{
    private static readonly string[] FactWords = ["shipped", "$", "balance", "credit hold"];

    internal static bool IsGrounded(string reply, IReadOnlyCollection<string> successfulPayloads)
    {
        var replyNumbers = Numbers(reply);
        if (successfulPayloads.Count == 0)
        {
            return replyNumbers.Count == 0
                && !FactWords.Any(word => reply.Contains(word, StringComparison.OrdinalIgnoreCase));
        }

        var known = successfulPayloads.SelectMany(Numbers).ToHashSet(StringComparer.Ordinal);
        return replyNumbers.All(known.Contains);
    }

    internal static IReadOnlyList<string> Numbers(string text) =>
        Number().Matches(text).Select(match => Normalize(match.Value)).ToArray();

    private static string Normalize(string token)
    {
        var value = ThousandsGroups().IsMatch(token) ? token.Replace(",", "") : token.Replace(',', '.');
        return decimal.TryParse(value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var number)
            ? number.ToString("0.############", CultureInfo.InvariantCulture)
            : value;
    }

    [GeneratedRegex(@"\d+(?:[.,]\d+)*")]
    private static partial Regex Number();

    [GeneratedRegex(@"^\d{1,3}(?:,\d{3})+(?:\.\d+)?$")]
    private static partial Regex ThousandsGroups();
}

internal sealed class AssistantTurn(
    IFoundryChat chat,
    IDistributorTools tools,
    ConversationStore store,
    AuditLog audit,
    IOptions<FoundryOptions> foundryOptions,
    IOptions<DataRegionOptions> dataOptions,
    TimeProvider time,
    ILoggerFactory loggers)
{
    private const int MaxRounds = 3;
    private const int MaxToolCallsPerRound = 2;
    private const int HistoryMessages = 20;

    private readonly ILogger _log = loggers.CreateLogger("Assistant.Turn");

    internal async Task<TurnResult> RunAsync(AccessToken actor, string text, CancellationToken requestAborted)
    {
        var started = Stopwatch.GetTimestamp();
        var foundry = foundryOptions.Value;
        var prompt = TenantPrompts.For(actor.TenantId);

        // A blocked region or tenant never sends the user text to Foundry.
        if (!foundry.CanCall || prompt is null || !RegionGate.Allows(dataOptions.Value, foundry, actor.TenantId))
        {
            return Complete(actor, started, "blocked", new TurnResult(StatusCodes.Status503ServiceUnavailable, AssistantText.CannotRetrieve, null));
        }

        var history = store.Read(actor.TenantId, actor.Subject);
        if (history.Count == 0)
        {
            audit.Append(time.GetUtcNow(), actor, "conversation_started", "thread", "ok", 0);
            _log.LogInformation("conversation_started {TenantId}", actor.TenantId);
        }

        var messages = new List<ChatTurnMessage> { new("system", prompt) };
        messages.AddRange(WithoutRefusals(history).TakeLast(HistoryMessages).Select(message => new ChatTurnMessage(message.Role, message.Text)));
        messages.Add(new ChatTurnMessage("user", text));

        var toolDefinitions = NorthlineClient.IsDemoCustomer(actor);
        var payloads = new List<string>();
        var sources = new List<string>();

        using var budget = CancellationTokenSource.CreateLinkedTokenSource(requestAborted);
        budget.CancelAfter(CallLimits.Budget);
        try
        {
            for (var round = 0; round < MaxRounds; round++)
            {
                var reply = await chat.CompleteAsync(messages, toolDefinitions ? ToolCatalog.Definitions() : null, budget.Token);
                if (reply.ToolCalls.Count == 0)
                {
                    var answer = reply.Content?.Trim() ?? "";
                    if (answer.Length == 0)
                    {
                        break;
                    }

                    if (!Grounding.IsGrounded(answer, payloads))
                    {
                        store.Append(actor.TenantId, actor.Subject, text, AssistantText.CannotRetrieve, null);
                        return Complete(actor, started, "ungrounded", new TurnResult(StatusCodes.Status200OK, AssistantText.CannotRetrieve, null));
                    }

                    var source = sources.Count == 0 ? null : string.Join(", ", sources);
                    store.Append(actor.TenantId, actor.Subject, text, answer, source);
                    return Complete(actor, started, "ok", new TurnResult(StatusCodes.Status200OK, answer, source));
                }

                if (!toolDefinitions || round == MaxRounds - 1)
                {
                    break;
                }

                var calls = reply.ToolCalls.Take(MaxToolCallsPerRound).ToArray();
                messages.Add(new ChatTurnMessage("assistant", reply.Content, calls));
                foreach (var call in calls)
                {
                    var result = await CallToolAsync(actor, call, budget.Token);
                    if (result.Ok)
                    {
                        payloads.Add(result.Payload);
                        if (result.Source is not null && !sources.Contains(result.Source))
                        {
                            sources.Add(result.Source);
                        }
                    }

                    messages.Add(new ChatTurnMessage("tool", result.Payload, ToolCallId: call.Id));
                }
            }
        }
        catch (Exception ex) when (ex is OutboundFailedException or OperationCanceledException)
        {
            return Complete(actor, started, "failed", new TurnResult(StatusCodes.Status503ServiceUnavailable, AssistantText.CannotRetrieve, null));
        }

        store.Append(actor.TenantId, actor.Subject, text, AssistantText.CannotRetrieve, null);
        return Complete(actor, started, "no_answer", new TurnResult(StatusCodes.Status200OK, AssistantText.CannotRetrieve, null));
    }

    private async Task<ToolResult> CallToolAsync(AccessToken actor, ToolCall call, CancellationToken cancellationToken)
    {
        var started = Stopwatch.GetTimestamp();
        var name = ToolCatalog.SourceFor(call.Name) is null ? "unknown" : call.Name;
        var result = name == "unknown"
            ? ToolResult.Unavailable("rejected")
            : await tools.CallAsync(actor, name, call.Arguments, cancellationToken);
        var ms = ElapsedMs(started);
        audit.Append(time.GetUtcNow(), actor, "tool_called", name, result.Outcome, ms);
        _log.LogInformation("tool_called {TenantId} {Tool} {Outcome} {Ms}", actor.TenantId, name, result.Outcome, ms);
        return result;
    }

    private TurnResult Complete(AccessToken actor, long started, string outcome, TurnResult result)
    {
        var ms = ElapsedMs(started);
        audit.Append(time.GetUtcNow(), actor, "message_completed", "messages", outcome, ms);
        _log.LogInformation("message_completed {TenantId} {Outcome} {Ms}", actor.TenantId, outcome, ms);
        return result;
    }

    // [ASSUMED] Refused exchanges stay in the saved conversation for display, but are left out of the model's history
    // so the model does not copy its own refusals.
    internal static List<StoredMessage> WithoutRefusals(IReadOnlyList<StoredMessage> history)
    {
        var kept = new List<StoredMessage>();
        for (var i = 0; i < history.Count; i++)
        {
            if (i + 1 < history.Count
                && history[i].Role == "user"
                && history[i + 1].Role == "assistant"
                && history[i + 1].Text == AssistantText.CannotRetrieve)
            {
                i++;
                continue;
            }

            kept.Add(history[i]);
        }

        return kept;
    }

    private static int ElapsedMs(long started) =>
        (int)Math.Min(int.MaxValue, Stopwatch.GetElapsedTime(started).TotalMilliseconds);
}
