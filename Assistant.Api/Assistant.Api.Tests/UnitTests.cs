using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Assistant.Api.Tests;

public sealed class TokenCodecTests
{
    private static readonly byte[] Key = Encoding.UTF8.GetBytes(AssistantApiFactory.TestSigningKey);
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 12, 0, 0, TimeSpan.Zero);

    private static string Demo(DateTimeOffset issued) =>
        TokenCodec.Issue("northline-supply", "riley.chen", "customer", "A-1042", Key, issued);

    [Fact]
    public void Round_trip_returns_the_claims()
    {
        Assert.True(TokenCodec.TryRead(Demo(Now), Key, Now, out var access));
        Assert.Equal("northline-supply", access.TenantId);
        Assert.Equal("riley.chen", access.Subject);
        Assert.Equal("customer", access.Relationship);
        Assert.Equal("A-1042", access.AccountNumber);
    }

    [Fact]
    public void Tampered_payload_is_rejected()
    {
        var parts = Demo(Now).Split('.');
        var json = Encoding.UTF8.GetString(FromBase64Url(parts[1])).Replace("northline-supply", "other-tenant");
        var forged = parts[0] + "." + Base64Url(Encoding.UTF8.GetBytes(json)) + "." + parts[2];

        Assert.False(TokenCodec.TryRead(forged, Key, Now, out _));
    }

    [Fact]
    public void Wrong_key_is_rejected()
    {
        var other = Encoding.UTF8.GetBytes("another-signing-key-that-is-long-enough-123");
        Assert.False(TokenCodec.TryRead(Demo(Now), other, Now, out _));
    }

    [Fact]
    public void Alg_none_is_rejected_even_when_signed()
    {
        var parts = Demo(Now).Split('.');
        var header = Base64Url("""{"alg":"none","typ":"JWT"}"""u8.ToArray());
        var signature = Base64Url(HMACSHA256.HashData(Key, Encoding.ASCII.GetBytes(header + "." + parts[1])));

        Assert.False(TokenCodec.TryRead(header + "." + parts[1] + "." + signature, Key, Now, out _));
        Assert.False(TokenCodec.TryRead(header + "." + parts[1] + ".", Key, Now, out _));
    }

    [Fact]
    public void Expired_token_is_rejected_after_clock_skew()
    {
        var token = Demo(Now);
        Assert.True(TokenCodec.TryRead(token, Key, Now.AddMinutes(15).AddSeconds(20), out _));
        Assert.False(TokenCodec.TryRead(token, Key, Now.AddMinutes(15).AddSeconds(31), out _));
    }

    [Fact]
    public void Lifetime_longer_than_fifteen_minutes_is_rejected()
    {
        var token = TokenCodec.Issue("northline-supply", "riley.chen", "customer", "A-1042", Key, Now, Now.AddMinutes(16));
        Assert.False(TokenCodec.TryRead(token, Key, Now.AddMinutes(1), out _));
    }

    internal static string Base64Url(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    internal static byte[] FromBase64Url(string text)
    {
        var padded = text.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(padded.PadRight(padded.Length + ((4 - (padded.Length % 4)) % 4), '='));
    }
}

public sealed class ConversationStoreTests
{
    [Fact]
    public void Threads_are_partitioned_by_tenant_and_subject()
    {
        var store = new ConversationStore(new ManualTime(DateTimeOffset.UnixEpoch));
        store.Append("tenant-a", "user-1", "hello a1", "reply", null);

        Assert.Equal(2, store.Read("tenant-a", "user-1").Count);
        Assert.Empty(store.Read("tenant-b", "user-1"));
        Assert.Empty(store.Read("tenant-a", "user-2"));
    }

    [Fact]
    public void Thread_is_deleted_seven_days_after_its_last_message()
    {
        var time = new ManualTime(new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero));
        var store = new ConversationStore(time);
        store.Append("tenant-a", "user-1", "hello", "reply", null);

        time.Now = time.Now.AddDays(7).AddSeconds(-1);
        Assert.Equal(2, store.Read("tenant-a", "user-1").Count);

        time.Now = time.Now.AddSeconds(1);
        Assert.Empty(store.Read("tenant-a", "user-1"));
    }
}

public sealed class GroundingTests
{
    private const string OrderPayload = """{"orderNumber":10482,"status":"Partially shipped","shippedOn":"2026-10-28","lineCount":4,"openLineCount":2}""";

    [Fact]
    public void Numbers_from_the_tool_payload_are_grounded()
    {
        Assert.True(Grounding.IsGrounded("Order 10482 shipped on 28 Oct. 2 of 4 lines are still open.", [OrderPayload]));
    }

    [Fact]
    public void A_number_missing_from_the_payload_is_not_grounded()
    {
        Assert.False(Grounding.IsGrounded("Order 10482 shipped on 28 Oct. 3 of 4 lines are still open.", [OrderPayload]));
    }

    [Fact]
    public void Prices_match_with_or_without_trailing_zeros()
    {
        Assert.True(Grounding.IsGrounded("The balance is $409.", ["""{"balance":409.00}"""]));
        Assert.True(Grounding.IsGrounded("It costs $24.50.", ["""{"unitPrice":24.5}"""]));
    }

    [Theory]
    [InlineData("I can answer questions about your orders and invoices.", true)]
    [InlineData("I can help with 3 things.", false)]
    [InlineData("Your order shipped.", false)]
    [InlineData("Your balance is clear.", false)]
    [InlineData("Prices are in $.", false)]
    [InlineData("You are not on credit hold.", false)]
    public void Answers_without_tools_cannot_state_facts(string reply, bool grounded)
    {
        Assert.Equal(grounded, Grounding.IsGrounded(reply, []));
    }
}

public sealed class FoundryChatClientTests
{
    private const string ApiKey = "unit-test-foundry-key";

    private static FoundryChatClient Client(StubHandler handler, OutboundBreakers breakers) =>
        new(new HttpClient(handler), Options.Create(new FoundryOptions
        {
            ApiKey = ApiKey,
            ProjectEndpoint = "https://example.services.ai.azure.com/api/projects/demo",
            OpenAiEndpoint = "https://example.openai.azure.com/openai/v1/",
            Model = "gpt-4.1-mini",
            Region = "canadaeast",
        }), breakers, TimeProvider.System);

    [Fact]
    public async Task Request_uses_api_key_header_and_snake_case_body()
    {
        var handler = new StubHandler(_ => StubHandler.Json(HttpStatusCode.OK, """
            {"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":"get_order","arguments":"{\"order_number\":10482}"}}]}}]}
            """));
        var client = Client(handler, new OutboundBreakers());
        var messages = new List<ChatTurnMessage>
        {
            new("system", "prompt"),
            new("user", "Has order 10482 shipped?"),
            new("assistant", null, [new ToolCall("call_0", "list_orders", "{}")]),
            new("tool", """{"orders":[]}""", ToolCallId: "call_0"),
        };

        var reply = await client.CompleteAsync(messages, ToolCatalog.Definitions(), CancellationToken.None);

        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("https://example.openai.azure.com/openai/v1/chat/completions", request.Uri.ToString());
        Assert.Equal(ApiKey, request.Headers["api-key"]);
        Assert.False(request.Headers.ContainsKey("Authorization"));
        Assert.DoesNotContain(ApiKey, request.Uri.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain(ApiKey, request.Body, StringComparison.Ordinal);

        using var body = JsonDocument.Parse(request.Body);
        var root = body.RootElement;
        Assert.Equal("gpt-4.1-mini", root.GetProperty("model").GetString());
        Assert.Equal(5, root.GetProperty("tools").GetArrayLength());
        var sent = root.GetProperty("messages");
        Assert.Equal("system", sent[0].GetProperty("role").GetString());
        Assert.Equal("list_orders", sent[2].GetProperty("tool_calls")[0].GetProperty("function").GetProperty("name").GetString());
        Assert.Equal("call_0", sent[3].GetProperty("tool_call_id").GetString());

        var call = Assert.Single(reply.ToolCalls);
        Assert.Equal("get_order", call.Name);
        Assert.Equal("""{"order_number":10482}""", call.Arguments);
    }

    [Fact]
    public async Task Breaker_opens_after_three_failures_and_hides_the_key()
    {
        var handler = new StubHandler(_ => StubHandler.Json(HttpStatusCode.InternalServerError, """{"error":"boom"}"""));
        var client = Client(handler, new OutboundBreakers());
        var messages = new List<ChatTurnMessage> { new("user", "hi") };

        for (var i = 0; i < 4; i++)
        {
            var error = await Assert.ThrowsAsync<OutboundFailedException>(() => client.CompleteAsync(messages, null, CancellationToken.None));
            Assert.DoesNotContain(ApiKey, error.Message, StringComparison.Ordinal);
        }

        Assert.Equal(3, handler.Requests.Count);
    }

    [Fact]
    public async Task Http_endpoint_is_never_called()
    {
        var handler = new StubHandler(_ => StubHandler.Json(HttpStatusCode.OK, "{}"));
        var client = new FoundryChatClient(new HttpClient(handler), Options.Create(new FoundryOptions
        {
            ApiKey = ApiKey,
            ProjectEndpoint = "https://example.services.ai.azure.com/api/projects/demo",
            OpenAiEndpoint = "http://example.openai.azure.com/openai/v1",
            Model = "gpt-4.1-mini",
        }), new OutboundBreakers(), TimeProvider.System);

        await Assert.ThrowsAsync<OutboundFailedException>(() => client.CompleteAsync([new("user", "hi")], null, CancellationToken.None));
        Assert.Empty(handler.Requests);
    }
}

public sealed class NorthlineClientTests
{
    private static readonly AccessToken Demo = new("northline-supply", "riley.chen", "customer", "A-1042", DateTimeOffset.MaxValue);

    private static (NorthlineClient Client, StubHandler Handler) Create(Func<HttpRequestMessage, HttpResponseMessage>? respond = null)
    {
        var handler = new StubHandler(respond ?? Default);
        var client = new NorthlineClient(
            new HttpClient(handler),
            new NorthlineSession(),
            new OutboundBreakers(),
            Options.Create(new NorthlineOptions { BaseUrl = "http://localhost:5080" }),
            TimeProvider.System);
        return (client, handler);
    }

    private static HttpResponseMessage Default(HttpRequestMessage request) => request.RequestUri!.AbsolutePath switch
    {
        "/session" => StubHandler.Json(HttpStatusCode.OK, """{"token":"session-token","displayName":"Riley Chen","accountName":"Apex Machining","accountNumber":"A-1042"}"""),
        "/orders/10482" => StubHandler.Json(HttpStatusCode.OK, """{"orderNumber":10482,"lineCount":4,"openLineCount":2}"""),
        _ => StubHandler.Json(HttpStatusCode.OK, "{}"),
    };

    [Theory]
    [InlineData("other-tenant", "riley.chen", "customer", "A-1042")]
    [InlineData("northline-supply", "someone.else", "customer", "A-1042")]
    [InlineData("northline-supply", "riley.chen", "employee", "A-1042")]
    [InlineData("northline-supply", "riley.chen", "customer", "A-2000")]
    public async Task Non_demo_actor_is_refused_without_a_request(string tenant, string subject, string relationship, string account)
    {
        var (client, handler) = Create();
        var result = await client.CallAsync(new AccessToken(tenant, subject, relationship, account, DateTimeOffset.MaxValue), "list_orders", "{}", CancellationToken.None);

        Assert.False(result.Ok);
        Assert.Equal("rejected", result.Outcome);
        Assert.Equal(ToolResult.UnavailablePayload, result.Payload);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task Account_in_arguments_is_not_forwarded()
    {
        var (client, handler) = Create();
        var result = await client.CallAsync(Demo, "get_order", """{"order_number":10482,"account":"B-9999","tenantId":"other"}""", CancellationToken.None);

        Assert.True(result.Ok);
        Assert.Equal("Orders API", result.Source);
        Assert.Collection(handler.Requests,
            signIn =>
            {
                Assert.Equal("/session", signIn.Uri.AbsolutePath);
                Assert.Equal("""{"userName":"riley.chen"}""", signIn.Body);
            },
            order =>
            {
                Assert.Equal("http://localhost:5080/orders/10482", order.Uri.ToString());
                Assert.Equal("Bearer session-token", order.Headers["Authorization"]);
            });
        Assert.DoesNotContain(handler.Requests, request => request.Uri.ToString().Contains("B-9999") || request.Body.Contains("B-9999"));
    }

    [Theory]
    [InlineData("search_catalog", """{"query":"A-2000"}""")]
    [InlineData("get_order", """{"order_number":"10482/../account"}""")]
    [InlineData("get_order", """{"order_number":-1}""")]
    [InlineData("get_account_for", "{}")]
    public async Task Unsafe_arguments_are_rejected_without_a_request(string tool, string arguments)
    {
        var (client, handler) = Create();
        var result = await client.CallAsync(Demo, tool, arguments, CancellationToken.None);

        Assert.Equal("rejected", result.Outcome);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task Session_for_another_account_is_not_used()
    {
        var (client, handler) = Create(request => request.RequestUri!.AbsolutePath == "/session"
            ? StubHandler.Json(HttpStatusCode.OK, """{"token":"t","accountNumber":"A-9999"}""")
            : StubHandler.Json(HttpStatusCode.OK, "{}"));

        var result = await client.CallAsync(Demo, "get_account", "{}", CancellationToken.None);

        Assert.False(result.Ok);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task Expired_session_signs_in_once_and_retries_once()
    {
        var sessions = 0;
        var (client, handler) = Create(request =>
        {
            if (request.RequestUri!.AbsolutePath == "/session")
            {
                sessions++;
                return StubHandler.Json(HttpStatusCode.OK, $$"""{"token":"s{{sessions}}","accountNumber":"A-1042"}""");
            }

            return request.Headers.Authorization!.Parameter == "s1"
                ? StubHandler.Json(HttpStatusCode.Unauthorized, "{}")
                : StubHandler.Json(HttpStatusCode.OK, """{"orders":[]}""");
        });

        var result = await client.CallAsync(Demo, "list_orders", "{}", CancellationToken.None);

        Assert.True(result.Ok);
        Assert.Equal(2, sessions);
        Assert.Equal(4, handler.Requests.Count);
    }

    [Theory]
    [InlineData("http://example.com")]
    [InlineData("ftp://localhost")]
    public void Plain_http_is_allowed_only_for_localhost(string url)
    {
        Assert.False(NorthlineClient.TryBaseUri(url, out _));
        Assert.True(NorthlineClient.TryBaseUri("http://127.0.0.1:5080", out _));
        Assert.True(NorthlineClient.TryBaseUri("https://northline.example", out _));
    }
}
