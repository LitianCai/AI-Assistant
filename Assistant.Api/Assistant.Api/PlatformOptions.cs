namespace Assistant.Api;

internal sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public string SigningKey { get; set; } = "";

    public override string ToString() =>
        string.IsNullOrWhiteSpace(SigningKey) ? "missing" : "configured";
}

internal sealed class DataRegionOptions
{
    public const string SectionName = "Data";

    public string Region { get; set; } = "";

    public bool QuebecTransferApproved { get; set; }
}

internal sealed class NorthlineOptions
{
    public const string SectionName = "NorthlineSupply";

    public string BaseUrl { get; set; } = "";
}

internal static class DemoActor
{
    internal const string TenantId = "northline-supply";
    internal const string Subject = "riley.chen";
    internal const string Relationship = "customer";
    internal const string AccountNumber = "A-1042";
    internal const string UserName = "riley.chen";
    internal const string Issuer = "assistant-api";
    internal const string Audience = "assistant-api";
}

internal static class TokenLimits
{
    internal static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    // [ASSUMED] A token that expired within the last 30 seconds is still accepted.
    internal static readonly TimeSpan ClockSkew = TimeSpan.FromSeconds(30);
}

internal static class CallLimits
{
    // [ASSUMED] The reply must finish within 12 seconds because the widget stops waiting at 15.
    internal static readonly TimeSpan Budget = TimeSpan.FromSeconds(12);
    internal static readonly TimeSpan FoundryTimeout = TimeSpan.FromSeconds(12);
    internal static readonly TimeSpan NorthlineTimeout = TimeSpan.FromSeconds(5);
    internal const int MaxText = 2000;
}

internal static class RegionGate
{
    internal static bool Allows(DataRegionOptions data, FoundryOptions foundry, string tenantId)
    {
        if (!string.Equals(tenantId, DemoActor.TenantId, StringComparison.Ordinal))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(data.Region) || string.IsNullOrWhiteSpace(foundry.Region))
        {
            return false;
        }

        if (!string.Equals(data.Region, foundry.Region, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        // Quebec personal information stays blocked until a privacy impact assessment is recorded.
        if (data.Region.Equals("quebec", StringComparison.OrdinalIgnoreCase) && !data.QuebecTransferApproved)
        {
            return false;
        }

        return true;
    }
}

internal static class SigningKey
{
    internal static byte[]? Bytes(string secret)
    {
        var trimmed = secret.Trim();
        if (trimmed.Length < 32)
        {
            return null;
        }

        return System.Text.Encoding.UTF8.GetBytes(trimmed);
    }
}
