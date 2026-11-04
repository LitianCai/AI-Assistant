using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace Assistant.Api;

internal sealed record ToolResult(bool Ok, string Outcome, string Payload, string? Source)
{
    internal const string UnavailablePayload = """{"available":false}""";

    internal static ToolResult Unavailable(string outcome) => new(false, outcome, UnavailablePayload, null);
}

internal interface IDistributorTools
{
    Task<ToolResult> CallAsync(AccessToken actor, string tool, string argumentsJson, CancellationToken cancellationToken);
}

internal static class ToolCatalog
{
    internal const string GetAccount = "get_account";
    internal const string ListOrders = "list_orders";
    internal const string GetOrder = "get_order";
    internal const string ListInvoices = "list_invoices";
    internal const string SearchCatalog = "search_catalog";

    internal static string? SourceFor(string tool) => tool switch
    {
        GetAccount => "Account API",
        ListOrders or GetOrder => "Orders API",
        ListInvoices => "Invoices API",
        SearchCatalog => "Catalog API",
        _ => null,
    };

    // The account always comes from the verified token, so no tool takes an account or tenant argument.
    internal static JsonArray Definitions() => (JsonArray)JsonNode.Parse("""
        [
          {"type":"function","function":{"name":"get_account","description":"Get the signed-in customer's account name, buyer name, and credit hold flag.","parameters":{"type":"object","properties":{},"additionalProperties":false}}},
          {"type":"function","function":{"name":"list_orders","description":"List the signed-in customer's recent orders with status, ship date, and open line counts.","parameters":{"type":"object","properties":{},"additionalProperties":false}}},
          {"type":"function","function":{"name":"get_order","description":"Get one order of the signed-in customer, with its lines.","parameters":{"type":"object","properties":{"order_number":{"type":"integer","description":"The order number."}},"required":["order_number"],"additionalProperties":false}}},
          {"type":"function","function":{"name":"list_invoices","description":"List the signed-in customer's invoices with status, total, and balance.","parameters":{"type":"object","properties":{},"additionalProperties":false}}},
          {"type":"function","function":{"name":"search_catalog","description":"Search the catalog by SKU, name, material, or size. Returns price and availability.","parameters":{"type":"object","properties":{"query":{"type":"string","description":"Search words."}},"additionalProperties":false}}}
        ]
        """)!;
}

internal sealed class NorthlineSession
{
    // The distributor session token is held only in memory and is never logged or returned.
    private string? _token;

    internal SemaphoreSlim Gate { get; } = new(1, 1);

    internal string? Current => Volatile.Read(ref _token);

    internal void Set(string token) => Volatile.Write(ref _token, token);

    internal void Clear(string stale) => Interlocked.CompareExchange(ref _token, null, stale);

    public override string ToString() => Current is null ? "missing" : "configured";
}

internal sealed partial class NorthlineClient(
    HttpClient http,
    NorthlineSession session,
    OutboundBreakers breakers,
    IOptions<NorthlineOptions> options,
    TimeProvider time) : IDistributorTools
{
    private const int MaxQuery = 64;

    public async Task<ToolResult> CallAsync(
        AccessToken actor,
        string tool,
        string argumentsJson,
        CancellationToken cancellationToken)
    {
        var source = ToolCatalog.SourceFor(tool);
        if (source is null || !IsDemoCustomer(actor) || !TryBuildPath(tool, argumentsJson, out var path))
        {
            return ToolResult.Unavailable("rejected");
        }

        if (!TryBaseUri(options.Value.BaseUrl, out var baseUri))
        {
            return ToolResult.Unavailable("unavailable");
        }

        var breaker = breakers.Northline;
        if (!breaker.Allow(time.GetUtcNow()))
        {
            return ToolResult.Unavailable("open_circuit");
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(CallLimits.NorthlineTimeout);
        try
        {
            var token = await EnsureSessionAsync(baseUri, null, timeout.Token);
            using var first = await GetAsync(baseUri, path, token, timeout.Token);
            var response = first;
            HttpResponseMessage? retry = null;
            try
            {
                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    session.Clear(token);
                    token = await EnsureSessionAsync(baseUri, token, timeout.Token);
                    retry = await GetAsync(baseUri, path, token, timeout.Token);
                    response = retry;
                }

                if (response.StatusCode == HttpStatusCode.NotFound)
                {
                    breaker.Succeed();
                    return ToolResult.Unavailable("unavailable");
                }

                if (!response.IsSuccessStatusCode)
                {
                    breaker.Fail(time.GetUtcNow());
                    return ToolResult.Unavailable("unavailable");
                }

                var body = await response.Content.ReadAsStringAsync(timeout.Token);
                using var parsed = JsonDocument.Parse(body);
                breaker.Succeed();
                return new ToolResult(true, "ok", parsed.RootElement.GetRawText(), source);
            }
            finally
            {
                retry?.Dispose();
            }
        }
        catch (Exception ex) when (ex is OutboundFailedException or HttpRequestException or OperationCanceledException or JsonException)
        {
            breaker.Fail(time.GetUtcNow());
            return ToolResult.Unavailable("unavailable");
        }
    }

    internal static bool IsDemoCustomer(AccessToken actor) =>
        actor.TenantId == DemoActor.TenantId
        && actor.Subject == DemoActor.Subject
        && actor.Relationship == DemoActor.Relationship
        && actor.AccountNumber == DemoActor.AccountNumber;

    internal static bool TryBaseUri(string value, out Uri baseUri)
    {
        baseUri = null!;
        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
            || !string.IsNullOrEmpty(uri.UserInfo)
            || !string.IsNullOrEmpty(uri.Query))
        {
            return false;
        }

        var local = uri.Host is "localhost" or "127.0.0.1";
        if (uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && local))
        {
            return false;
        }

        baseUri = uri;
        return true;
    }

    private static bool TryBuildPath(string tool, string argumentsJson, out string path)
    {
        path = "";
        switch (tool)
        {
            case ToolCatalog.GetAccount:
                path = "/account";
                return true;
            case ToolCatalog.ListOrders:
                path = "/orders";
                return true;
            case ToolCatalog.ListInvoices:
                path = "/invoices";
                return true;
            case ToolCatalog.GetOrder:
                if (!TryReadArgument(argumentsJson, "order_number", out var number)
                    || !TryOrderNumber(number, out var orderNumber))
                {
                    return false;
                }

                path = "/orders/" + orderNumber.ToString(System.Globalization.CultureInfo.InvariantCulture);
                return true;
            case ToolCatalog.SearchCatalog:
                var query = "";
                if (TryReadArgument(argumentsJson, "query", out var value))
                {
                    if (value.ValueKind != JsonValueKind.String)
                    {
                        return false;
                    }

                    query = value.GetString()!.Trim();
                }

                if (query.Length > MaxQuery || AccountId().IsMatch(query))
                {
                    return false;
                }

                path = query.Length == 0 ? "/catalog" : "/catalog?q=" + Uri.EscapeDataString(query);
                return true;
            default:
                return false;
        }
    }

    private static bool TryReadArgument(string argumentsJson, string name, out JsonElement value)
    {
        value = default;
        try
        {
            using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(argumentsJson) ? "{}" : argumentsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object
                || !document.RootElement.TryGetProperty(name, out var property))
            {
                return false;
            }

            value = property.Clone();
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryOrderNumber(JsonElement value, out int orderNumber)
    {
        orderNumber = 0;
        if (value.ValueKind == JsonValueKind.Number)
        {
            return value.TryGetInt32(out orderNumber) && orderNumber > 0;
        }

        return value.ValueKind == JsonValueKind.String
            && OrderDigits().IsMatch(value.GetString()!)
            && int.TryParse(value.GetString(), System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out orderNumber)
            && orderNumber > 0;
    }

    private async Task<string> EnsureSessionAsync(Uri baseUri, string? stale, CancellationToken cancellationToken)
    {
        var current = session.Current;
        if (current is not null && current != stale)
        {
            return current;
        }

        await session.Gate.WaitAsync(cancellationToken);
        try
        {
            current = session.Current;
            if (current is not null && current != stale)
            {
                return current;
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(baseUri, "/session"))
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(new Dictionary<string, string> { ["userName"] = DemoActor.UserName }),
                    Encoding.UTF8,
                    "application/json"),
            };
            using var response = await http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new OutboundFailedException();
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object
                || !root.TryGetProperty("token", out var tokenElement)
                || tokenElement.ValueKind != JsonValueKind.String
                || string.IsNullOrWhiteSpace(tokenElement.GetString())
                || !root.TryGetProperty("accountNumber", out var accountElement)
                || accountElement.ValueKind != JsonValueKind.String
                || accountElement.GetString() != DemoActor.AccountNumber)
            {
                throw new OutboundFailedException();
            }

            var token = tokenElement.GetString()!;
            session.Set(token);
            return token;
        }
        finally
        {
            session.Gate.Release();
        }
    }

    private async Task<HttpResponseMessage> GetAsync(Uri baseUri, string path, string token, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(baseUri, path));
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.ParseAdd("application/json");
        return await http.SendAsync(request, cancellationToken);
    }

    [GeneratedRegex(@"\b[A-Za-z]-\d+\b")]
    private static partial Regex AccountId();

    [GeneratedRegex(@"^\d{1,9}$")]
    private static partial Regex OrderDigits();
}
