using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Assistant.Api.Tests;

public sealed class AssistantApiTests : IClassFixture<AssistantApiFactory>
{
    private readonly AssistantApiFactory _factory;

    public AssistantApiTests(AssistantApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_is_ok()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);
        Assert.Equal("ok", document.RootElement.GetProperty("status").GetString());
        Assert.Equal("no-store", string.Join(",", response.Headers.GetValues("Cache-Control")));
    }

    [Fact]
    public async Task Configured_key_is_read_and_kept_out_of_logs_and_health()
    {
        const string apiKey = "test-key";
        using var factory = new AssistantApiFactory { FoundryApiKey = apiKey };
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/health");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Contains("foundry_key_configured True", factory.LogMessages);
        Assert.DoesNotContain(factory.LogMessages, message => message.Contains(apiKey, StringComparison.Ordinal));
        Assert.DoesNotContain(apiKey, body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Missing_key_is_reported_as_not_configured()
    {
        using var factory = new AssistantApiFactory { FoundryApiKey = "  " };
        using var client = factory.CreateClient();
        await client.GetAsync("/health");

        Assert.Contains("foundry_key_configured False", factory.LogMessages);
    }
}

public sealed class AssistantApiFactory : WebApplicationFactory<Program>
{
    public string FoundryApiKey { get; init; } = "";

    public List<string> LogMessages { get; } = [];

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Foundry:ApiKey"] = FoundryApiKey,
            });
        });
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

    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information && category == "Assistant.Foundry";

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel))
        {
            return;
        }

        lock (messages)
        {
            messages.Add(formatter(state, exception));
        }
    }
}
