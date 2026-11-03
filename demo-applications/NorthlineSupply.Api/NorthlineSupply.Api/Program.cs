using System.Text.Json;
using NorthlineSupply.Api;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5080");
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});

builder.Services.AddSingleton<SessionStore>();
builder.Services.AddCors(options =>
{
    options.AddPolicy(DemoCors.Name, policy =>
    {
        policy.WithOrigins(DemoCors.Origins)
            .WithHeaders(DemoCors.Headers)
            .WithMethods(DemoCors.Methods);
    });
});

var app = builder.Build();
var requestLog = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("NorthlineSupply.Http");

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

app.UseCors(DemoCors.Name);

var data = app.MapGroup(string.Empty)
    .RequireCors(DemoCors.Name)
    .AddEndpointFilter<SessionFilter>();

data.MapGet("/account", (HttpContext http) =>
{
    // The account is the server-side session. Request account ids are ignored.
    var session = SessionFilter.Current(http);
    return Results.Ok(new AccountResponse(
        session.AccountName,
        session.AccountNumber,
        session.DisplayName,
        session.CreditHold));
});

data.MapGet("/orders", (HttpContext http) =>
    Results.Ok(new OrderListResponse(DemoData.OrdersFor(SessionFilter.Current(http)))));

data.MapGet("/orders/{orderNumber:int}", (HttpContext http, int orderNumber) =>
{
    var order = DemoData.OrderFor(SessionFilter.Current(http), orderNumber);
    return order is null ? Results.NotFound() : Results.Ok(order);
});

data.MapGet("/invoices", (HttpContext http) =>
    Results.Ok(new InvoiceListResponse(DemoData.InvoicesFor(SessionFilter.Current(http)))));

data.MapGet("/catalog", (HttpContext http, string? q) =>
    Results.Ok(new CatalogResponse(DemoData.CatalogFor(SessionFilter.Current(http), q))));

app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")))
    .RequireCors(DemoCors.Name);

app.MapPost("/session", async (HttpRequest request, SessionStore sessions) =>
{
    SessionRequest? body;
    try
    {
        body = await request.ReadFromJsonAsync<SessionRequest>();
    }
    catch (Exception ex) when (ex is JsonException or BadHttpRequestException or InvalidOperationException)
    {
        return Results.Json(new ApiTitle(ApiMessages.SignInFailed), statusCode: StatusCodes.Status401Unauthorized);
    }

    if (!SessionStore.IsDemoUser(body?.UserName))
    {
        return Results.Json(new ApiTitle(ApiMessages.SignInFailed), statusCode: StatusCodes.Status401Unauthorized);
    }

    var session = sessions.Create();
    return Results.Ok(new SessionResponse(
        session.Token,
        session.DisplayName,
        session.AccountName,
        session.AccountNumber));
}).RequireCors(DemoCors.Name);

app.Run();

public partial class Program
{
}

internal static class DemoCors
{
    internal const string Name = "NorthlineDemo";
    internal static readonly string[] Origins = ["http://localhost:5174", "http://localhost:5081"];
    internal static readonly string[] Headers = ["Authorization", "Content-Type"];
    internal static readonly string[] Methods = [HttpMethods.Get, HttpMethods.Post];
}
