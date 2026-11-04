using System.Net;
using System.Text.Json.Nodes;

namespace Assistant.Api.Tests;

internal sealed class FakeChat : IFoundryChat
{
    private readonly Queue<ChatReply> _replies = new();

    internal List<IReadOnlyList<ChatTurnMessage>> Calls { get; } = [];

    internal void Reply(string content) => _replies.Enqueue(new ChatReply(content, []));

    internal void CallTool(string id, string name, string arguments) =>
        _replies.Enqueue(new ChatReply(null, [new ToolCall(id, name, arguments)]));

    public Task<ChatReply> CompleteAsync(
        IReadOnlyList<ChatTurnMessage> messages,
        JsonArray? tools,
        CancellationToken cancellationToken)
    {
        lock (Calls)
        {
            Calls.Add(messages.ToArray());
            return Task.FromResult(_replies.Count > 0 ? _replies.Dequeue() : new ChatReply("Hello there.", []));
        }
    }
}

internal sealed class FakeTools : IDistributorTools
{
    internal Dictionary<string, ToolResult> Results { get; } = [];

    internal List<(AccessToken Actor, string Tool, string Arguments)> Calls { get; } = [];

    public Task<ToolResult> CallAsync(AccessToken actor, string tool, string argumentsJson, CancellationToken cancellationToken)
    {
        lock (Calls)
        {
            Calls.Add((actor, tool, argumentsJson));
        }

        return Task.FromResult(Results.TryGetValue(tool, out var result) ? result : ToolResult.Unavailable("unavailable"));
    }
}

internal sealed record SeenRequest(HttpMethod Method, Uri Uri, Dictionary<string, string> Headers, string Body);

internal sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    internal List<SeenRequest> Requests { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
        var headers = request.Headers.ToDictionary(header => header.Key, header => string.Join(",", header.Value), StringComparer.OrdinalIgnoreCase);
        Requests.Add(new SeenRequest(request.Method, request.RequestUri!, headers, body));
        return respond(request);
    }

    internal static HttpResponseMessage Json(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") };
}

internal sealed class ManualTime(DateTimeOffset start) : TimeProvider
{
    internal DateTimeOffset Now { get; set; } = start;

    public override DateTimeOffset GetUtcNow() => Now;
}
