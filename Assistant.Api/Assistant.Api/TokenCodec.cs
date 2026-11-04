using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Assistant.Api;

internal sealed record AccessToken(
    string TenantId,
    string Subject,
    string Relationship,
    string AccountNumber,
    DateTimeOffset ExpiresAt);

internal static class TokenCodec
{
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
        var header = Base64Url("""{"alg":"HS256","typ":"JWT"}"""u8.ToArray());
        var payloadJson = JsonSerializer.Serialize(new Dictionary<string, object>
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
        var payload = Base64Url(Encoding.UTF8.GetBytes(payloadJson));
        var signature = Base64Url(Sign(key, header, payload));
        return header + "." + payload + "." + signature;
    }

    internal static bool TryRead(string token, byte[] key, DateTimeOffset now, out AccessToken access)
    {
        access = null!;
        if (string.IsNullOrWhiteSpace(token) || key.Length < 32)
        {
            return false;
        }

        var parts = token.Split('.');
        if (parts.Length != 3 || parts.Any(part => part.Length == 0))
        {
            return false;
        }

        var headerBytes = FromBase64Url(parts[0]);
        var payloadBytes = FromBase64Url(parts[1]);
        var signature = FromBase64Url(parts[2]);
        if (headerBytes is null || payloadBytes is null || signature is null)
        {
            return false;
        }

        var expected = Sign(key, parts[0], parts[1]);
        if (signature.Length != expected.Length || !CryptographicOperations.FixedTimeEquals(signature, expected))
        {
            return false;
        }

        try
        {
            using var header = JsonDocument.Parse(headerBytes);
            if (header.RootElement.ValueKind != JsonValueKind.Object
                || !header.RootElement.TryGetProperty("alg", out var algorithm)
                || algorithm.ValueKind != JsonValueKind.String
                || algorithm.GetString() != "HS256")
            {
                return false;
            }

            using var payload = JsonDocument.Parse(payloadBytes);
            var root = payload.RootElement;
            if (root.ValueKind != JsonValueKind.Object
                || !TryClaim(root, "tid", out var tenantId)
                || !TryClaim(root, "sub", out var subject)
                || !TryClaim(root, "rel", out var relationship)
                || (relationship != "customer" && relationship != "employee")
                || !TryClaim(root, "acct", out var accountNumber)
                || !TryClaim(root, "iss", out var issuer)
                || issuer != DemoActor.Issuer
                || !TryClaim(root, "aud", out var audience)
                || audience != DemoActor.Audience
                || !TryUnix(root, "iat", out var issuedSeconds)
                || !TryUnix(root, "exp", out var expiresSeconds))
            {
                return false;
            }

            var issued = DateTimeOffset.FromUnixTimeSeconds(issuedSeconds);
            var expires = DateTimeOffset.FromUnixTimeSeconds(expiresSeconds);
            if (expires <= issued || expires - issued > TokenLimits.Lifetime)
            {
                return false;
            }

            if (issued - TokenLimits.ClockSkew > now || expires + TokenLimits.ClockSkew < now)
            {
                return false;
            }

            access = new AccessToken(tenantId, subject, relationship, accountNumber, expires);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryClaim(JsonElement root, string name, out string value)
    {
        value = "";
        if (!root.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        var text = property.GetString();
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        value = text.Trim();
        return true;
    }

    private static bool TryUnix(JsonElement root, string name, out long value)
    {
        value = 0;
        if (!root.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.Number)
        {
            return false;
        }

        return property.TryGetInt64(out value);
    }

    private static byte[] Sign(byte[] key, string header, string payload) =>
        HMACSHA256.HashData(key, Encoding.ASCII.GetBytes(header + "." + payload));

    private static string Base64Url(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[]? FromBase64Url(string text)
    {
        var padded = text.Replace('-', '+').Replace('_', '/');
        var remainder = padded.Length % 4;
        if (remainder == 1)
        {
            return null;
        }

        if (remainder > 0)
        {
            padded = padded.PadRight(padded.Length + (4 - remainder), '=');
        }

        try
        {
            return Convert.FromBase64String(padded);
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
