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
}

internal sealed class TenantResidencyOptions
{
    public string Id { get; set; } = "";

    public string Jurisdiction { get; set; } = "";

    // Set only after this tenant's privacy impact assessment and a written agreement exist.
    // Server config only. The browser, request body, query, header, and widget config cannot set it.
    public bool QuebecTransferApproved { get; set; }
}

internal sealed class TenantsOptions
{
    public const string SectionName = "Tenants";

    public List<TenantResidencyOptions> Entries { get; set; } = [];

    internal TenantResidencyOptions? For(string tenantId)
    {
        foreach (var entry in Entries)
        {
            if (string.Equals(entry.Id, tenantId, StringComparison.Ordinal))
            {
                return entry;
            }
        }

        return null;
    }
}

internal static class CloudRegionCatalog
{
    private readonly record struct RegionJurisdiction(string AzureRegion, string Jurisdiction);

    private static readonly RegionJurisdiction[] Entries =
    [
        new("canadaeast", "quebec"),
    ];

    internal static bool ServesJurisdiction(string azureRegion, string jurisdiction)
    {
        if (string.IsNullOrWhiteSpace(azureRegion) || string.IsNullOrWhiteSpace(jurisdiction))
        {
            return false;
        }

        foreach (var entry in Entries)
        {
            if (string.Equals(entry.AzureRegion, azureRegion, StringComparison.OrdinalIgnoreCase)
                && string.Equals(entry.Jurisdiction, jurisdiction, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    // [ASSUMED] "canada-other" is the config value for a recognized jurisdiction with no residency region; the founder has not named it.
    private static readonly string[] UnrestrictedJurisdictions = ["canada-other"];

    // Blank or unknown jurisdictions are treated like Quebec (founder decision, 22 November 2026).
    internal static bool AllowsRegion(string azureRegion, string jurisdiction)
    {
        var trimmed = jurisdiction?.Trim() ?? "";
        if (HasJurisdiction(trimmed))
        {
            return ServesJurisdiction(azureRegion, trimmed);
        }

        foreach (var unrestricted in UnrestrictedJurisdictions)
        {
            if (string.Equals(unrestricted, trimmed, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return ServesJurisdiction(azureRegion, Entries[0].Jurisdiction);
    }

    private static bool HasJurisdiction(string jurisdiction)
    {
        if (string.IsNullOrWhiteSpace(jurisdiction))
        {
            return false;
        }

        foreach (var entry in Entries)
        {
            if (string.Equals(entry.Jurisdiction, jurisdiction, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
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
    internal static bool Allows(DataRegionOptions data, FoundryOptions foundry, string tenantId, TenantsOptions tenants)
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

        var residency = tenants.For(tenantId);
        var jurisdiction = residency?.Jurisdiction?.Trim() ?? "";
        // Founder decision, 22 November 2026: a blank or unknown jurisdiction is blocked like Quebec until it is set correctly.
        var transferApproved = residency?.QuebecTransferApproved == true;
        if (!CloudRegionCatalog.AllowsRegion(data.Region, jurisdiction) && !transferApproved)
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
