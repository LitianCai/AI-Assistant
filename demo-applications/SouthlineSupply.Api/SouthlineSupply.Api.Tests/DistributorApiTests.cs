using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;

namespace SouthlineSupply.Api.Tests;

public sealed class DistributorApiTests : IClassFixture<SouthlineApiFactory>
{
    private static readonly Regex RequestLog = new(@"^(GET|POST|OPTIONS) /[A-Za-z0-9./_-]* \d{3}$", RegexOptions.CultureInvariant);

    private readonly SouthlineApiFactory _factory;

    public DistributorApiTests(SouthlineApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_is_ok_without_a_token()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ok", body.GetProperty("status").GetString());
        Assert.Equal("no-store", CacheControl(response));
    }

    [Fact]
    public async Task Sign_in_succeeds_for_maya_okonkwo()
    {
        using var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/session", new { userName = "maya.okonkwo", accountId = "OTHER" });
        var body = await ReadAsync(response);
        var token = body.GetProperty("token").GetString();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(token);
        Assert.Matches("^[0-9a-f]{64}$", token);
        Assert.Equal("Maya Okonkwo", body.GetProperty("displayName").GetString());
        Assert.Equal("Harbor Fabrication", body.GetProperty("accountName").GetString());
        Assert.Equal("H-7781", body.GetProperty("accountNumber").GetString());
        Assert.Equal("no-store", CacheControl(response));
    }

    [Fact]
    public async Task Sign_in_rejects_an_unknown_user()
    {
        using var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/session", new { userName = "someone.else" });
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Sign in failed.", body.GetProperty("title").GetString());
        Assert.Equal("no-store", CacheControl(response));
    }

    [Fact]
    public async Task Data_routes_reject_a_missing_or_unknown_token()
    {
        using var client = _factory.CreateClient();
        foreach (var path in new[] { "/account", "/orders", "/orders/22017", "/invoices", "/catalog" })
        {
            var missing = await client.GetAsync(path);
            var missingBody = await ReadAsync(missing);
            Assert.Equal(HttpStatusCode.Unauthorized, missing.StatusCode);
            Assert.Equal("Sign in required.", missingBody.GetProperty("title").GetString());
            Assert.Equal("no-store", CacheControl(missing));
        }

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new string('a', 64));
        var unknown = await client.GetAsync("/orders");
        var unknownBody = await ReadAsync(unknown);
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal("Sign in required.", unknownBody.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Orders_include_22017_with_one_open_line()
    {
        using var client = await SignedInClientAsync();
        var response = await client.GetAsync("/orders");
        var orders = (await ReadAsync(response)).GetProperty("orders");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(3, orders.GetArrayLength());
        Assert.Equal(22017, orders[0].GetProperty("orderNumber").GetInt32());
        Assert.Equal("Partially shipped", orders[0].GetProperty("status").GetString());
        Assert.Equal("2026-09-15", orders[0].GetProperty("placedOn").GetString());
        Assert.Equal("2026-09-22", orders[0].GetProperty("shippedOn").GetString());
        Assert.Equal(5, orders[0].GetProperty("lineCount").GetInt32());
        Assert.Equal(1, orders[0].GetProperty("openLineCount").GetInt32());
        Assert.Equal(21940, orders[1].GetProperty("orderNumber").GetInt32());
        Assert.Equal(0, orders[1].GetProperty("openLineCount").GetInt32());
        Assert.Equal("2026-07-20", orders[1].GetProperty("shippedOn").GetString());
        Assert.Equal(21703, orders[2].GetProperty("orderNumber").GetInt32());
        Assert.Equal("2026-05-19", orders[2].GetProperty("shippedOn").GetString());
        Assert.Equal("no-store", CacheControl(response));
    }

    [Fact]
    public async Task Order_22017_has_five_lines_and_one_open()
    {
        using var client = await SignedInClientAsync();
        var response = await client.GetAsync("/orders/22017");
        var order = await ReadAsync(response);
        var lines = order.GetProperty("lines");
        var open = lines.EnumerateArray().Count(line => line.GetProperty("status").GetString() == "Open");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(22017, order.GetProperty("orderNumber").GetInt32());
        Assert.Equal(5, order.GetProperty("lineCount").GetInt32());
        Assert.Equal(1, order.GetProperty("openLineCount").GetInt32());
        Assert.Equal(5, lines.GetArrayLength());
        Assert.Equal(1, open);
        Assert.Equal("SL-1108", lines[0].GetProperty("sku").GetString());
        Assert.Equal("Copper bus bar", lines[0].GetProperty("name").GetString());
        Assert.Equal("Shipped", lines[0].GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, lines[0].GetProperty("promiseDate").ValueKind);
        Assert.Equal(86.00m, lines[0].GetProperty("unitPrice").GetDecimal());
        Assert.Equal("SL-4488", lines[4].GetProperty("sku").GetString());
        Assert.Equal("Aluminum cable tray", lines[4].GetProperty("name").GetString());
        Assert.Equal("Open", lines[4].GetProperty("status").GetString());
        Assert.Equal("2026-11-18", lines[4].GetProperty("promiseDate").GetString());
    }

    [Fact]
    public async Task Unknown_order_is_not_found()
    {
        using var client = await SignedInClientAsync();
        var response = await client.GetAsync("/orders/99999");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain("21940", body);
        Assert.DoesNotContain("21703", body);
        Assert.DoesNotContain("22017", body);
        Assert.Equal("no-store", CacheControl(response));
    }

    [Fact]
    public async Task Invoice_4410_balance_is_1284_50()
    {
        using var client = await SignedInClientAsync();
        var response = await client.GetAsync("/invoices");
        var invoices = (await ReadAsync(response)).GetProperty("invoices");
        var open = invoices.EnumerateArray().Single(invoice => invoice.GetProperty("invoiceNumber").GetString() == "INV-4410");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(3, invoices.GetArrayLength());
        Assert.Equal(22017, open.GetProperty("orderNumber").GetInt32());
        Assert.Equal("2026-09-22", open.GetProperty("billedOn").GetString());
        Assert.Equal("Open", open.GetProperty("status").GetString());
        Assert.Equal(1284.50m, open.GetProperty("total").GetDecimal());
        Assert.Equal(1284.50m, open.GetProperty("balance").GetDecimal());
        Assert.Equal("no-store", CacheControl(response));
    }

    [Fact]
    public async Task Catalog_copper_returns_the_bus_bar()
    {
        using var client = await SignedInClientAsync();
        var all = await client.GetAsync("/catalog");
        var allItems = (await ReadAsync(all)).GetProperty("items");
        var copper = await client.GetAsync("/catalog?q=copper");
        var items = (await ReadAsync(copper)).GetProperty("items");

        Assert.Equal(HttpStatusCode.OK, all.StatusCode);
        Assert.Equal(5, allItems.GetArrayLength());
        Assert.Equal(HttpStatusCode.OK, copper.StatusCode);
        Assert.Equal(1, items.GetArrayLength());
        Assert.Equal("SL-1108", items[0].GetProperty("sku").GetString());
        Assert.Equal("Copper bus bar", items[0].GetProperty("name").GetString());
        Assert.Equal(86.00m, items[0].GetProperty("unitPrice").GetDecimal());
        Assert.Equal("SL-2214", items[0].GetProperty("substitutes")[0].GetString());
        Assert.Equal("no-store", CacheControl(copper));
    }

    [Fact]
    public async Task Caller_cannot_switch_accounts()
    {
        using var client = await SignedInClientAsync();
        var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/account?accountId=OTHER&tenantId=OTHER&companyId=OTHER&accountNumber=OTHER");
        request.Headers.Add("accountId", "OTHER");
        request.Headers.Add("accountNumber", "Z-9");
        var response = await client.SendAsync(request);
        var account = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Harbor Fabrication", account.GetProperty("accountName").GetString());
        Assert.Equal("H-7781", account.GetProperty("accountNumber").GetString());
        Assert.Equal("Maya Okonkwo", account.GetProperty("buyerName").GetString());
        Assert.False(account.GetProperty("creditHold").GetBoolean());

        var orders = await client.GetAsync("/orders?accountId=OTHER");
        var listed = (await ReadAsync(orders)).GetProperty("orders");
        Assert.Equal(22017, listed[0].GetProperty("orderNumber").GetInt32());

        var catalog = await client.GetAsync("/catalog?q=copper&accountId=OTHER");
        var items = (await ReadAsync(catalog)).GetProperty("items");
        Assert.Equal(1, items.GetArrayLength());
        Assert.Equal(86.00m, items[0].GetProperty("unitPrice").GetDecimal());
    }

    [Fact]
    public async Task Cors_allows_only_the_demo_origins()
    {
        using var client = _factory.CreateClient();
        foreach (var origin in new[] { "http://localhost:5175", "http://localhost:5091" })
        {
            var preflight = new HttpRequestMessage(HttpMethod.Options, "/account");
            preflight.Headers.Add("Origin", origin);
            preflight.Headers.Add("Access-Control-Request-Method", "GET");
            preflight.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");
            var response = await client.SendAsync(preflight);

            Assert.Equal(origin, SingleHeader(response, "Access-Control-Allow-Origin"));
            var methods = SingleHeader(response, "Access-Control-Allow-Methods");
            Assert.Contains("GET", methods, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("POST", methods, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("*", methods);
            var headers = SingleHeader(response, "Access-Control-Allow-Headers");
            Assert.Contains("authorization", headers, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("content-type", headers, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("*", headers);
        }

        var blocked = new HttpRequestMessage(HttpMethod.Get, "/health");
        blocked.Headers.Add("Origin", "https://example.com");
        var denied = await client.SendAsync(blocked);
        Assert.False(denied.Headers.TryGetValues("Access-Control-Allow-Origin", out var echoed) && echoed.Contains("*"));
        if (denied.Headers.TryGetValues("Access-Control-Allow-Origin", out echoed))
        {
            Assert.DoesNotContain("https://example.com", echoed);
            Assert.DoesNotContain("*", echoed);
        }
    }

    [Fact]
    public async Task Requests_are_logged_without_secrets()
    {
        _factory.LogMessages.Clear();
        using var client = _factory.CreateClient();
        var signIn = await client.PostAsJsonAsync("/session", new { userName = "maya.okonkwo" });
        var token = (await ReadAsync(signIn)).GetProperty("token").GetString();
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var orders = await client.GetAsync("/orders/22017?accountId=OTHER");
        Assert.Equal(HttpStatusCode.OK, orders.StatusCode);

        Assert.Contains("POST /session 200", _factory.LogMessages);
        Assert.Contains("GET /orders/22017 200", _factory.LogMessages);
        Assert.All(_factory.LogMessages, message => Assert.Matches(RequestLog, message));
        Assert.DoesNotContain(_factory.LogMessages, message => message.Contains(token, StringComparison.Ordinal));
        Assert.DoesNotContain(_factory.LogMessages, message => message.Contains("maya.okonkwo", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(_factory.LogMessages, message => message.Contains("Harbor", StringComparison.Ordinal));
        Assert.DoesNotContain(_factory.LogMessages, message => message.Contains('?'));
    }

    private async Task<HttpClient> SignedInClientAsync()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/session", new { userName = "maya.okonkwo" });
        response.EnsureSuccessStatusCode();
        var token = (await ReadAsync(response)).GetProperty("token").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);
        return document.RootElement.Clone();
    }

    private static string CacheControl(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Cache-Control", out var values) ? string.Join(",", values) : "";

    private static string SingleHeader(HttpResponseMessage response, string name) =>
        Assert.Single(response.Headers.GetValues(name));
}

public sealed class SouthlineApiFactory : WebApplicationFactory<Program>
{
    public List<string> LogMessages { get; } = [];

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureLogging(logging =>
        {
            logging.ClearProviders();
            logging.AddProvider(new ListLogProvider(LogMessages));
        });
    }
}

internal sealed class ListLogProvider(List<string> messages) : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new ListLog(categoryName, messages);

    public void Dispose()
    {
    }
}

internal sealed class ListLog(string category, List<string> messages) : ILogger
{
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel) || category != "SouthlineSupply.Http")
        {
            return;
        }

        lock (messages)
        {
            messages.Add(formatter(state, exception));
        }
    }
}
