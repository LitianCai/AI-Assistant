namespace Assistant.Api;

internal sealed class FoundryOptions
{
    public const string SectionName = "Foundry";

    public string ApiKey { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);

    public override string ToString() => IsConfigured ? "configured" : "missing";
}
