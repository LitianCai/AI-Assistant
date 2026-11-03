using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace NorthlineSupply.Api;

internal static class DemoAccount
{
    internal const string UserName = "riley.chen";
    internal const string DisplayName = "Riley Chen";
    internal const string AccountName = "Apex Machining";
    internal const string AccountNumber = "A-1042";
    internal const bool CreditHold = false;
}

internal static class ApiMessages
{
    internal const string SignInRequired = "Sign in required.";
    internal const string SignInFailed = "Sign in failed.";
}

internal sealed record DemoSession(
    string Token,
    string DisplayName,
    string AccountName,
    string AccountNumber,
    bool CreditHold)
{
    internal const string HttpItemKey = "NorthlineSupply.Session";
}

internal sealed class SessionStore
{
    // [ASSUMED] A session lasts until the process restarts.
    private readonly ConcurrentDictionary<string, DemoSession> _sessions = new(StringComparer.Ordinal);

    internal static bool IsDemoUser(string? userName) =>
        string.Equals(userName, DemoAccount.UserName, StringComparison.Ordinal);

    internal DemoSession Create()
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var session = new DemoSession(
            token,
            DemoAccount.DisplayName,
            DemoAccount.AccountName,
            DemoAccount.AccountNumber,
            DemoAccount.CreditHold);
        _sessions[token] = session;
        return session;
    }

    internal DemoSession? Find(string token) =>
        _sessions.TryGetValue(token, out var session) ? session : null;
}

internal sealed record SessionRequest(string? UserName);

internal sealed class SessionFilter : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var sessions = http.RequestServices.GetRequiredService<SessionStore>();
        if (!TryReadBearer(http.Request, out var token) || sessions.Find(token) is not DemoSession session)
        {
            return ValueTask.FromResult<object?>(
                Results.Json(new ApiTitle(ApiMessages.SignInRequired), statusCode: StatusCodes.Status401Unauthorized));
        }

        http.Items[DemoSession.HttpItemKey] = session;
        return next(context);
    }

    internal static DemoSession Current(HttpContext http) =>
        (DemoSession)http.Items[DemoSession.HttpItemKey]!;

    private static bool TryReadBearer(HttpRequest request, out string token)
    {
        token = "";
        var header = request.Headers.Authorization.ToString();
        const string prefix = "Bearer ";
        if (!header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        token = header[prefix.Length..].Trim();
        return token.Length > 0;
    }
}
