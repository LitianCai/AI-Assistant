using System.Security.Claims;
using System.Text.Json;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Assistant.Api;

internal sealed record AccessToken(
    string TenantId,
    string Subject,
    string Relationship,
    string AccountNumber,
    DateTimeOffset ExpiresAt);

internal static class TokenCodec
{
    private static readonly JsonWebTokenHandler Handler = new()
    {
        MapInboundClaims = false,
        SetDefaultTimesOnTokenCreation = false,
    };

    internal static string Issue(
        string tenantId,
        string subject,
        string relationship,
        string accountNumber,
        byte[] key,
        DateTimeOffset now) =>
        Issue(tenantId, subject, relationship, accountNumber, key, now, now.Add(TokenLimits.Lifetime));

    internal static string Issue(
        string tenantId,
        string subject,
        string relationship,
        string accountNumber,
        byte[] key,
        DateTimeOffset issuedAt,
        DateTimeOffset expiresAt)
    {
        var payload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["tid"] = tenantId,
            ["sub"] = subject,
            ["rel"] = relationship,
            ["acct"] = accountNumber,
            ["iss"] = DemoActor.Issuer,
            ["aud"] = DemoActor.Audience,
            ["iat"] = issuedAt.ToUnixTimeSeconds(),
            ["exp"] = expiresAt.ToUnixTimeSeconds(),
        });
        var credentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256);
        return Handler.CreateToken(payload, credentials);
    }

    internal static bool TryRead(string token, byte[] key, DateTimeOffset now, out AccessToken access)
    {
        access = null!;
        if (string.IsNullOrWhiteSpace(token) || key.Length < 32)
        {
            return false;
        }

        TokenValidationResult result;
        try
        {
            // [ASSUMED] ValidateTokenAsync is waited here so TryRead stays synchronous for the bearer check.
            result = Handler.ValidateTokenAsync(token, Parameters(key, now)).GetAwaiter().GetResult();
        }
        catch (Exception ex) when (ex is JsonException or SecurityTokenException or ArgumentException)
        {
            return false;
        }

        if (!result.IsValid
            || result.SecurityToken is not JsonWebToken jwt
            || !HeaderIsHs256(jwt)
            || !TryClaim(jwt, "tid", out var tenantId)
            || !TryClaim(jwt, "sub", out var subject)
            || !TryClaim(jwt, "rel", out var relationship)
            || (relationship != "customer" && relationship != "employee")
            || !TryClaim(jwt, "acct", out var accountNumber)
            || !TryClaim(jwt, "iss", out var issuer)
            || issuer != DemoActor.Issuer
            || !TryClaim(jwt, "aud", out var audience)
            || audience != DemoActor.Audience
            || !TryUnix(jwt, "exp", out var expires))
        {
            return false;
        }

        access = new AccessToken(tenantId, subject, relationship, accountNumber, expires);
        return true;
    }

    private static TokenValidationParameters Parameters(byte[] key, DateTimeOffset now) =>
        new()
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            RequireSignedTokens = true,
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TokenLimits.ClockSkew,
            LogTokenId = false,
            LogValidationExceptions = false,
            LifetimeValidator = (notBefore, expires, securityToken, validationParameters) =>
                securityToken is JsonWebToken jwt && LifetimeValid(jwt, now, validationParameters.ClockSkew),
        };

    private static bool HeaderIsHs256(JsonWebToken jwt) =>
        jwt.TryGetHeaderValue<string>("alg", out var algorithm)
        && string.Equals(algorithm, SecurityAlgorithms.HmacSha256, StringComparison.Ordinal);

    private static bool LifetimeValid(JsonWebToken jwt, DateTimeOffset now, TimeSpan clockSkew)
    {
        if (!TryUnix(jwt, "iat", out var issued) || !TryUnix(jwt, "exp", out var expires))
        {
            return false;
        }

        if (expires <= issued || expires - issued > TokenLimits.Lifetime)
        {
            return false;
        }

        return issued - clockSkew <= now && expires + clockSkew >= now;
    }

    private static bool TryClaim(JsonWebToken jwt, string name, out string value)
    {
        value = "";
        if (!jwt.TryGetClaim(name, out var claim) || claim.ValueType != ClaimValueTypes.String)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(claim.Value))
        {
            return false;
        }

        value = claim.Value.Trim();
        return true;
    }

    private static bool TryUnix(JsonWebToken jwt, string name, out DateTimeOffset value)
    {
        value = default;
        if (!jwt.TryGetClaim(name, out var claim) || !IsJsonInteger(claim.ValueType))
        {
            return false;
        }

        if (!long.TryParse(claim.Value, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var seconds))
        {
            return false;
        }

        value = DateTimeOffset.FromUnixTimeSeconds(seconds);
        return true;
    }

    private static bool IsJsonInteger(string valueType) =>
        valueType == ClaimValueTypes.Integer
        || valueType == ClaimValueTypes.Integer32
        || valueType == ClaimValueTypes.Integer64;
}
