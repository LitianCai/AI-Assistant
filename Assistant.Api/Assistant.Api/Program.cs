using System.Text.Json;
using Assistant.Api;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// [ASSUMED] Local development listens on https://localhost:7091 so it does not share port 5080 with NorthlineSupply.Api.
builder.WebHost.UseUrls("https://localhost:7091");
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
});

// Foundry:ApiKey is read from user secrets in Development, or from the host environment. The value is not logged or returned.
builder.Services.Configure<FoundryOptions>(builder.Configuration.GetSection(FoundryOptions.SectionName));

var app = builder.Build();
var requestLog = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Assistant.Http");
var foundryLog = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Assistant.Foundry");
var foundry = app.Services.GetRequiredService<IOptions<FoundryOptions>>().Value;
foundryLog.LogInformation("foundry_key_configured {Configured}", foundry.IsConfigured);

app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers.CacheControl = "no-store";
        return Task.CompletedTask;
    });

    var status = StatusCodes.Status500InternalServerError;
    try
    {
        await next();
        status = context.Response.StatusCode;
    }
    finally
    {
        var path = context.Request.Path.Value;
        if (string.IsNullOrEmpty(path))
        {
            path = "/";
        }

        requestLog.LogInformation("{Method} {Path} {Status}", context.Request.Method, path, status);
    }
});

app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")));

app.Run();

public partial class Program
{
}

internal sealed record HealthResponse(string Status);
