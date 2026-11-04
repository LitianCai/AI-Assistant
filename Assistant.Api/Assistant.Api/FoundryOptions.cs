namespace Assistant.Api;

internal sealed class FoundryOptions
{
    public const string SectionName = "Foundry";

    public string ApiKey { get; set; } = "";

    public string ProjectEndpoint { get; set; } = "";

    public string OpenAiEndpoint { get; set; } = "";

    public string Model { get; set; } = "";

    public string Region { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);

    public bool CanCall =>
        IsConfigured
        && IsHttps(ProjectEndpoint)
        && IsHttps(OpenAiEndpoint)
        && !string.IsNullOrWhiteSpace(Model);

    public override string ToString() => IsConfigured ? "configured" : "missing";

    internal static bool IsHttps(string value) =>
        Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps;
}
