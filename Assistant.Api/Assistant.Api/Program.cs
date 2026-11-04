using System.Text.Json;
using Assistant.Api;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// [ASSUMED] Local development listens on https://localhost:7091 so it does not share port 5080 with NorthlineSupply.Api.
builder.WebHost.UseUrls("https://localhost:7091");
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
builder.Logging.AddFilter("System.Net.Http.HttpClient", LogLevel.Warning);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
});

// Foundry:ApiKey and Auth:SigningKey are read from user secrets in Development, or from the host environment. The values are not logged or returned.
builder.Services.Configure<FoundryOptions>(builder.Configuration.GetSection(FoundryOptions.SectionName));
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection(AuthOptions.SectionName));
builder.Services.Configure<DataRegionOptions>(builder.Configuration.GetSection(DataRegionOptions.SectionName));
builder.Services.Configure<NorthlineOptions>(builder.Configuration.GetSection(NorthlineOptions.SectionName));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ConversationStore>();
builder.Services.AddSingleton<AuditLog>();
builder.Services.AddSingleton<OutboundBreakers>();
builder.Services.AddSingleton<NorthlineSession>();
builder.Services.AddScoped<AssistantTurn>();

builder.Services.AddHttpClient<IFoundryChat, FoundryChatClient>(client => client.Timeout = CallLimits.FoundryTimeout)
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false });
builder.Services.AddHttpClient<IDistributorTools, NorthlineClient>(client => client.Timeout = CallLimits.NorthlineTimeout)
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false });

builder.Services.AddCors(options =>
{
    options.AddPolicy(AssistantCors.Name, policy =>
    {
        policy.WithOrigins(AssistantCors.Origins)
            .WithHeaders(AssistantCors.Headers)
            .WithMethods(AssistantCors.Methods);
    });
});

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

app.UseCors(AssistantCors.Name);

app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")));

app.MapGet("/conversation", (HttpRequest request, IOptions<AuthOptions> auth, TimeProvider time, ConversationStore store) =>
{
    var check = BearerAuth.Verify(request, auth.Value, time);
    if (check.Failure is not null)
    {
        return check.Failure;
    }

    var actor = check.Actor!;
    var messages = store.Read(actor.TenantId, actor.Subject)
        .Select(message => new ConversationMessage(message.Role, message.Text, message.Source))
        .ToArray();
    return Results.Ok(new ConversationResponse(messages));
});

app.MapPost("/messages", async (HttpRequest request, IOptions<AuthOptions> auth, TimeProvider time, AssistantTurn turn) =>
{
    var check = BearerAuth.Verify(request, auth.Value, time);
    if (check.Failure is not null)
    {
        return check.Failure;
    }

    var text = await MessageBody.ReadTextAsync(request);
    if (text is null)
    {
        return Results.BadRequest();
    }

    var result = await turn.RunAsync(check.Actor!, text, request.HttpContext.RequestAborted);
    if (result.Status != StatusCodes.Status200OK)
    {
        return Results.StatusCode(result.Status);
    }

    return Results.Ok(new SendResponse(result.Text, result.Source));
});

if (app.Environment.IsDevelopment())
{
    // Development only. Mints the one fixed demo customer token and ignores any request body.
    app.MapPost("/dev/token", (IOptions<AuthOptions> auth, TimeProvider time) =>
    {
        var key = SigningKey.Bytes(auth.Value.SigningKey);
        if (key is null)
        {
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        var token = TokenCodec.Issue(
            DemoActor.TenantId,
            DemoActor.Subject,
            DemoActor.Relationship,
            DemoActor.AccountNumber,
            key,
            time.GetUtcNow());
        return Results.Ok(new DevTokenResponse(token, (int)TokenLimits.Lifetime.TotalSeconds));
    });
}

app.Run();

public partial class Program
{
}

internal sealed record HealthResponse(string Status);

internal sealed record ConversationMessage(string Role, string Text, string? Source);

internal sealed record ConversationResponse(IReadOnlyList<ConversationMessage> Messages);

internal sealed record SendResponse(string Text, string? Source);

internal sealed record DevTokenResponse(string Token, int ExpiresIn);

internal static class AssistantCors
{
    internal const string Name = "AssistantWidget";
    internal static readonly string[] Origins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5081"];
    internal static readonly string[] Headers = ["Authorization", "Content-Type", "Accept"];
    internal static readonly string[] Methods = [HttpMethods.Get, HttpMethods.Post];
}

internal sealed record AuthCheck(AccessToken? Actor, IResult? Failure);

internal static class BearerAuth
{
    // The tenant, subject, and account come only from the verified bearer token, never from a query, body, or other header.
    internal static AuthCheck Verify(HttpRequest request, AuthOptions auth, TimeProvider time)
    {
        var key = SigningKey.Bytes(auth.SigningKey);
        if (key is null)
        {
            return new AuthCheck(null, Results.StatusCode(StatusCodes.Status503ServiceUnavailable));
        }

        var headers = request.Headers.Authorization;
        const string prefix = "Bearer ";
        if (headers.Count != 1
            || headers[0] is not string header
            || !header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            || !TokenCodec.TryRead(header[prefix.Length..].Trim(), key, time.GetUtcNow(), out var actor))
        {
            return new AuthCheck(null, Results.Unauthorized());
        }

        return new AuthCheck(actor, null);
    }
}

internal static class MessageBody
{
    // Only the text field is read. Any tenant, account, or locale field in the body is ignored.
    internal static async Task<string?> ReadTextAsync(HttpRequest request)
    {
        if (request.ContentLength is > 16_384)
        {
            return null;
        }

        try
        {
            using var document = await JsonDocument.ParseAsync(request.Body, cancellationToken: request.HttpContext.RequestAborted);
            if (document.RootElement.ValueKind != JsonValueKind.Object
                || !document.RootElement.TryGetProperty("text", out var property)
                || property.ValueKind != JsonValueKind.String)
            {
                return null;
            }

            var text = property.GetString()!.Trim();
            return text.Length is 0 or > CallLimits.MaxText ? null : text;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
