using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;

namespace Assistant.Api.Tests;

public sealed class EndpointTests
{
    private const string ApiKey = "endpoint-test-foundry-key";
    private static readonly byte[] Key = Encoding.UTF8.GetBytes(AssistantApiFactory.TestSigningKey);

    private static string TokenFor(string subject, string tenant = "northline-supply", string account = "A-1042") =>
        TokenCodec.Issue(tenant, subject, "customer", account, Key, DateTimeOffset.UtcNow);

    private static HttpClient Client(AssistantApiFactory factory, string? token)
    {
        var client = factory.CreateClient();
        if (token is not null)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return client;
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    [Fact]
    public async Task Missing_or_invalid_bearer_is_401()
    {
        using var factory = new AssistantApiFactory { FoundryApiKey = ApiKey };
        using var anonymous = Client(factory, null);
        using var invalid = Client(factory, "not-a-token");
        var valid = TokenFor("riley.chen");

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/conversation")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/messages", new { text = "hi" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/conversation?access_token=" + valid)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/messages", new { text = "hi", token = valid })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await invalid.GetAsync("/conversation")).StatusCode);
        Assert.Empty(factory.Chat.Calls);
    }

    [Fact]
    public async Task Dev_token_ignores_a_body_tenant()
    {
        using var factory = new AssistantApiFactory();
        using var client = Client(factory, null);
        var response = await client.PostAsJsonAsync("/dev/token", new { tenantId = "other-tenant", subject = "mallory", account = "B-9999" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var token = (await Json(response)).GetProperty("token").GetString()!;
        Assert.True(TokenCodec.TryRead(token, Key, DateTimeOffset.UtcNow, out var access));
        Assert.Equal("northline-supply", access.TenantId);
        Assert.Equal("riley.chen", access.Subject);
        Assert.Equal("customer", access.Relationship);
        Assert.Equal("A-1042", access.AccountNumber);
    }

    [Fact]
    public async Task Dev_token_is_not_mapped_in_production()
    {
        using var factory = new AssistantApiFactory { EnvironmentName = "Production" };
        using var client = Client(factory, null);

        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync("/dev/token", null)).StatusCode);
    }

    [Fact]
    public async Task Dev_token_is_503_without_a_signing_key()
    {
        using var factory = new AssistantApiFactory { Settings = { ["Auth:SigningKey"] = "" } };
        using var client = Client(factory, null);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsync("/dev/token", null)).StatusCode);
    }

    [Fact]
    public async Task Two_subjects_are_isolated()
    {
        using var factory = new AssistantApiFactory { FoundryApiKey = ApiKey };
        using var first = Client(factory, TokenFor("riley.chen"));
        using var second = Client(factory, TokenFor("sam.lee"));
        using var otherTenant = Client(factory, TokenFor("riley.chen", tenant: "other-tenant"));

        Assert.Equal(HttpStatusCode.OK, (await first.PostAsJsonAsync("/messages", new { text = "Hello" })).StatusCode);

        Assert.Equal(2, (await Json(await first.GetAsync("/conversation"))).GetProperty("messages").GetArrayLength());
        Assert.Equal(0, (await Json(await second.GetAsync("/conversation"))).GetProperty("messages").GetArrayLength());
        Assert.Equal(0, (await Json(await otherTenant.GetAsync("/conversation"))).GetProperty("messages").GetArrayLength());
    }

    [Fact]
    public async Task Order_answer_has_Orders_API_source_when_the_tool_returned_the_numbers()
    {
        using var factory = new AssistantApiFactory { FoundryApiKey = ApiKey };
        factory.Tools.Results["get_order"] = new ToolResult(true, "ok",
            """{"orderNumber":10482,"status":"Partially shipped","shippedOn":"2026-10-28","lineCount":4,"openLineCount":2}""", "Orders API");
        factory.Chat.CallTool("call_1", "get_order", """{"order_number":10482,"account":"B-9999"}""");
        factory.Chat.Reply("Order 10482 shipped on 28 Oct. 2 of 4 lines are still open.");
        using var client = Client(factory, TokenFor("riley.chen"));

        var response = await client.PostAsJsonAsync("/messages", new { text = "Has order 10482 shipped?", tenantId = "other-tenant" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await Json(response);
        Assert.Equal("Order 10482 shipped on 28 Oct. 2 of 4 lines are still open.", body.GetProperty("text").GetString());
        Assert.Equal("Orders API", body.GetProperty("source").GetString());
        var call = Assert.Single(factory.Tools.Calls);
        Assert.Equal("northline-supply", call.Actor.TenantId);
        Assert.Equal("A-1042", call.Actor.AccountNumber);
    }

    [Fact]
    public async Task Order_answer_is_replaced_when_the_tool_did_not_return_the_numbers()
    {
        using var factory = new AssistantApiFactory { FoundryApiKey = ApiKey };
        factory.Tools.Results["get_order"] = new ToolResult(true, "ok", """{"orderNumber":10482,"status":"Shipped"}""", "Orders API");
        factory.Chat.CallTool("call_1", "get_order", """{"order_number":10482}""");
        factory.Chat.Reply("Order 10482 shipped on 28 Oct. 2 of 4 lines are still open.");
        using var client = Client(factory, TokenFor("riley.chen"));

        var body = await Json(await client.PostAsJsonAsync("/messages", new { text = "Has order 10482 shipped?" }));

        Assert.Equal("I can't retrieve that right now.", body.GetProperty("text").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("source").ValueKind);
    }

    [Fact]
    public async Task Invented_number_is_replaced_and_not_stored()
    {
        using var factory = new AssistantApiFactory { FoundryApiKey = ApiKey };
        factory.Chat.Reply("Your invoice total is 1,250 dollars.");
        using var client = Client(factory, TokenFor("riley.chen"));

        var body = await Json(await client.PostAsJsonAsync("/messages", new { text = "What do I owe?" }));
        var conversation = await (await client.GetAsync("/conversation")).Content.ReadAsStringAsync();

        Assert.Equal("I can't retrieve that right now.", body.GetProperty("text").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("source").ValueKind);
        Assert.DoesNotContain("1,250", conversation, StringComparison.Ordinal);
        Assert.Contains("I can't retrieve that right now.", conversation, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Matching_region_calls_Foundry()
    {
        using var factory = new AssistantApiFactory
        {
            FoundryApiKey = ApiKey,
            Settings = { ["Data:Region"] = "quebec", ["Foundry:Region"] = "quebec" },
        };
        using var client = Client(factory, TokenFor("riley.chen"));

        var response = await client.PostAsJsonAsync("/messages", new { text = "What can you do?" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotEmpty(factory.Chat.Calls);
    }

    [Fact]
    public async Task Mismatched_region_and_other_tenants_do_not_call_Foundry()
    {
        using var factory = new AssistantApiFactory { FoundryApiKey = ApiKey, Settings = { ["Data:Region"] = "canadacentral" } };
        using var client = Client(factory, TokenFor("riley.chen"));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsJsonAsync("/messages", new { text = "Hi" })).StatusCode);

        using var sameRegion = new AssistantApiFactory { FoundryApiKey = ApiKey };
        using var other = Client(sameRegion, TokenFor("someone", tenant: "other-tenant"));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await other.PostAsJsonAsync("/messages", new { text = "Hi" })).StatusCode);

        Assert.Empty(factory.Chat.Calls);
        Assert.Empty(sameRegion.Chat.Calls);
    }

    [Fact]
    public async Task Missing_Foundry_key_returns_503_without_calling_Foundry()
    {
        using var factory = new AssistantApiFactory { FoundryApiKey = "" };
        using var client = Client(factory, TokenFor("riley.chen"));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsJsonAsync("/messages", new { text = "Hi" })).StatusCode);
        Assert.Empty(factory.Chat.Calls);
    }

    [Fact]
    public async Task Logs_and_audit_do_not_contain_the_question_or_secrets()
    {
        const string question = "Is my private pump question 4471 answered?";
        using var factory = new AssistantApiFactory { FoundryApiKey = ApiKey };
        factory.Tools.Results["list_orders"] = new ToolResult(true, "ok", """{"orders":[]}""", "Orders API");
        factory.Chat.CallTool("call_1", "list_orders", "{}");
        factory.Chat.Reply("I can't retrieve that right now.");
        var token = TokenFor("riley.chen");
        using var client = Client(factory, token);

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/messages", new { text = question })).StatusCode);

        var audit = factory.Services.GetRequiredService<AuditLog>().Entries;
        Assert.Contains(audit, entry => entry.Action == "conversation_started");
        Assert.Contains(audit, entry => entry.Action == "tool_called" && entry.Target == "list_orders" && entry.Outcome == "ok");
        Assert.Contains(audit, entry => entry.Action == "message_completed" && entry.Outcome == "ok");
        Assert.All(audit, entry => Assert.Equal("riley.chen", entry.Actor));

        string[] logs;
        lock (factory.LogMessages)
        {
            logs = factory.LogMessages.ToArray();
        }

        Assert.Contains(logs, line => line.StartsWith("tool_called northline-supply list_orders ok", StringComparison.Ordinal));
        Assert.Contains(logs, line => line.StartsWith("message_completed northline-supply ok", StringComparison.Ordinal));
        var recorded = logs.Concat(audit.Select(entry => entry.ToString())).ToArray();
        foreach (var secret in new[] { question, "4471", ApiKey, AssistantApiFactory.TestSigningKey, token })
        {
            Assert.DoesNotContain(recorded, line => line.Contains(secret, StringComparison.Ordinal));
        }
    }
}
