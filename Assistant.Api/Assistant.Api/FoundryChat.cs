using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace Assistant.Api;

internal sealed record ToolCall(string Id, string Name, string Arguments);

internal sealed record ChatTurnMessage(
    string Role,
    string? Content,
    IReadOnlyList<ToolCall>? ToolCalls = null,
    string? ToolCallId = null);

internal sealed record ChatReply(string? Content, IReadOnlyList<ToolCall> ToolCalls);

internal interface IFoundryChat
{
    Task<ChatReply> CompleteAsync(
        IReadOnlyList<ChatTurnMessage> messages,
        JsonArray? tools,
        CancellationToken cancellationToken);
}

internal sealed class FoundryChatClient(
    HttpClient http,
    IOptions<FoundryOptions> options,
    OutboundBreakers breakers,
    TimeProvider time) : IFoundryChat
{
    public async Task<ChatReply> CompleteAsync(
        IReadOnlyList<ChatTurnMessage> messages,
        JsonArray? tools,
        CancellationToken cancellationToken)
    {
        var foundry = options.Value;
        if (!foundry.CanCall)
        {
            throw new OutboundFailedException();
        }

        var breaker = breakers.Foundry;
        if (!breaker.Allow(time.GetUtcNow()))
        {
            throw new OutboundFailedException();
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(CallLimits.FoundryTimeout);
        try
        {
            // The key is sent only in the api-key header. History is sent from ConversationStore; no Foundry thread is created.
            using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint(foundry.OpenAiEndpoint));
            request.Headers.Add("api-key", foundry.ApiKey.Trim());
            request.Headers.Accept.ParseAdd("application/json");
            request.Content = new StringContent(
                Body(foundry.Model.Trim(), messages, tools).ToJsonString(),
                Encoding.UTF8,
                "application/json");

            using var response = await http.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                breaker.Fail(time.GetUtcNow());
                throw new OutboundFailedException();
            }

            var reply = Parse(await response.Content.ReadAsStringAsync(timeout.Token));
            breaker.Succeed();
            return reply;
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or JsonException or InvalidOperationException or KeyNotFoundException or IndexOutOfRangeException)
        {
            breaker.Fail(time.GetUtcNow());
            throw new OutboundFailedException();
        }
    }

    internal static Uri Endpoint(string openAiEndpoint) =>
        new(openAiEndpoint.Trim().TrimEnd('/') + "/chat/completions", UriKind.Absolute);

    internal static JsonObject Body(string model, IReadOnlyList<ChatTurnMessage> messages, JsonArray? tools)
    {
        var list = new JsonArray();
        foreach (var message in messages)
        {
            var item = new JsonObject
            {
                ["role"] = message.Role,
                ["content"] = message.Content,
            };
            if (message.ToolCalls is { Count: > 0 })
            {
                var calls = new JsonArray();
                foreach (var call in message.ToolCalls)
                {
                    calls.Add(new JsonObject
                    {
                        ["id"] = call.Id,
                        ["type"] = "function",
                        ["function"] = new JsonObject
                        {
                            ["name"] = call.Name,
                            ["arguments"] = call.Arguments,
                        },
                    });
                }

                item["tool_calls"] = calls;
            }

            if (message.ToolCallId is not null)
            {
                item["tool_call_id"] = message.ToolCallId;
            }

            list.Add(item);
        }

        var body = new JsonObject
        {
            ["model"] = model,
            ["messages"] = list,
        };
        if (tools is { Count: > 0 })
        {
            body["tools"] = tools;
        }

        return body;
    }

    private static ChatReply Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var message = document.RootElement.GetProperty("choices")[0].GetProperty("message");
        string? content = null;
        if (message.TryGetProperty("content", out var contentElement) && contentElement.ValueKind == JsonValueKind.String)
        {
            content = contentElement.GetString();
        }

        var calls = new List<ToolCall>();
        if (message.TryGetProperty("tool_calls", out var toolCalls) && toolCalls.ValueKind == JsonValueKind.Array)
        {
            foreach (var call in toolCalls.EnumerateArray())
            {
                var function = call.GetProperty("function");
                calls.Add(new ToolCall(
                    call.GetProperty("id").GetString() ?? "",
                    function.GetProperty("name").GetString() ?? "",
                    function.TryGetProperty("arguments", out var arguments) && arguments.ValueKind == JsonValueKind.String
                        ? arguments.GetString() ?? "{}"
                        : "{}"));
            }
        }

        return new ChatReply(content, calls);
    }
}
