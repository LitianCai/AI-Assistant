# Assistant integration guide

This guide is for your developers. It covers how to load the widget and how your server creates the short-lived token the widget sends.

## 1. What you are integrating

Two pieces:

1. Your page loads the widget script and mounts it.
2. Your backend, after your user is signed in, creates a short-lived signed token. The page passes that token into the widget. The widget sends it on each API call as `Authorization: Bearer`.

The page does not choose the tenant. The tenant id is a claim inside the token. Your server sets it. We assign the tenant id.

## 2. Add the widget

Load the script, then mount the widget. The script address below is a placeholder. Use the URL we give you for each environment.

```html
<script src="https://widget.example.com/ai-assistant.umd.js"></script>
<script>
  AiAssistant.mountAiAssistant(document.body, {
    token: tokenFromYourServer,
    apiBaseUrl: "https://api.example.com",
    preset: "ask",
    display: "words",
    corner: "bottom-right",
    primaryColor: "#1d4ed8",
    brandName: "Example Co",
    locale: "en"
  });
</script>
```

`tokenFromYourServer` is a token your backend just created for the signed-in user. Do not hard-code a token in the page.

Fields:

- `token` — required. The widget sends it only as `Authorization: Bearer`. There is no tenant id field. Do not add one.
- `apiBaseUrl` — base URL of the assistant API, with no path. The widget calls `{apiBaseUrl}/conversation` and `{apiBaseUrl}/messages`. If you omit it, or set it to `preview`, the widget stays on a local preview and does not call the API.
- `preset` — launcher word: `ask`, `help`, `question`, `chat`, or `info`. Default is `ask`. Any other value becomes `ask`.
- `display` — `words` or `icon`. Default is `words`. The launcher shows words or an icon, never both.
- `corner` — `bottom-right`, `bottom-left`, `top-right`, or `top-left`. Default is `bottom-right`.
- `primaryColor` — brand color as `#rrggbb`. White text on that color must meet WCAG AA contrast (4.5:1). If it does not, the widget uses `#1d4ed8`.
- `brandName` — plain text in the panel. Markup is stripped. Maximum 40 characters. If you omit it, the name is `Assistant`.
- `locale` — optional language hint: English, French, or Spanish (`en`, `fr`, `es`, including tags such as `fr-CA`). If it is missing or not one of those languages, the widget uses the page language, then the browser language, then English. The widget has no language switcher.

## 3. Create the token

After your user is signed in, your server creates a JWT and signs it with HS256. Give that JWT to your page. The page passes it as `token`.

The signing key is the UTF-8 bytes of the shared secret string. Do not base64-decode the secret before signing. The secret is the one we generate for your tenant and show once in our admin console (see section 4). You store it in your own secret store and never send it back to us.

Claims:

- `tid` — tenant id we assigned. Required non-empty string.
- `sub` — your user id for the signed-in person. Required non-empty string.
- `rel` — relationship. Required string. The only accepted values are `customer` and `employee`. Any other value is rejected.
- `acct` — your customer account id (account number) for that user. Required non-empty string. The API reads the account only from this claim.
- `iss` — `assistant-api`
- `aud` — `assistant-api`
- `iat` — issued-at time as a Unix timestamp in seconds (a JSON number, not a string).
- `exp` — expiry as a Unix timestamp in seconds. Set it 15 minutes after `iat`.

`tid`, `sub`, `rel`, `acct`, `iss`, and `aud` must be JSON strings. `iat` and `exp` must be JSON integers. Blank claims are rejected. `exp` must be later than `iat`, and `exp` minus `iat` must not be more than 15 minutes. A longer lifetime is rejected. The API allows 30 seconds of clock difference.

Example payload. These ids are fake.

```json
{
  "tid": "tenant-example",
  "sub": "user-example",
  "rel": "customer",
  "acct": "account-example",
  "iss": "assistant-api",
  "aud": "assistant-api",
  "iat": 1700000000,
  "exp": 1700000900
}
```

`rel` `customer` is the relationship the current demo order tools accept, and only for the one built-in demo user. A token with `rel` `employee` can still pass signature checks. Those order tools do not run for it.

The demo API, when it is running in Development, also exposes `POST /dev/token`. That endpoint ignores the request body and returns one fixed demo token signed with the shared development key, plus `expiresIn` of 900. It is not present in Production (the path responds 404). Do not use it for your users. Your server creates the token.

## 4. Signing secret

Target design: one secret per tenant, stored in our Key Vault. Your backend signs with that tenant's secret.

For the first release, we generate each tenant's secret and show it once in our admin console. We do not email it. You keep it in your own secret store. Rotation will be supported when the admin console is built. The option of your own key pair is not in the first release.

The current demo API still uses one shared development key for every tenant. Production will use the per-tenant secret.

The secret is a string of at least 32 characters. The API turns that string into UTF-8 bytes and uses those bytes as the HS256 key. If the secret is missing or shorter than 32 characters, the API returns HTTP 503 and does not issue or accept tokens.

### To be confirmed

For the first release, the secret is delivered by the admin console, as described above. How we deliver the secret in later releases is not decided. This guide does not choose a later method.

Do not paste the secret into this document, into email, or into the checklist. The checklist cells for that row stay `[DON'T PUT SENSITIVE INFO HERE]`. Keep the secret in your own secret store. If you need to record a Key Vault secret name, keep the name in your own records. Do not put the secret value next to the name.

## 5. What the widget calls

The widget calls two paths on `apiBaseUrl`. It sends `Authorization: Bearer` and `Accept: application/json`. It does not send cookies. It does not send a tenant id.

`GET /conversation`

Returns the current user's messages. HTTP 200 body:

```json
{
  "messages": [
    { "role": "user", "text": "Hello", "source": null },
    { "role": "assistant", "text": "…", "source": "Orders API" }
  ]
}
```

`role` is `user` or `assistant`. `source` is a string or null.

`POST /messages`

Body is only the message text:

```json
{ "text": "Where is my order?" }
```

The API reads `text` and ignores every other field, including a tenant id, an account id, or a token. `text` must be a non-empty string of at most 2000 characters. A body larger than 16384 bytes is rejected.

HTTP 200 body:

```json
{ "text": "…", "source": "Orders API" }
```

`source` may be null.

Auth and errors:

- Missing `Authorization`, more than one `Authorization` header, a value that is not `Bearer`, or a token that fails checks: HTTP 401. A token in the query string or in the JSON body does not count. The widget shows "Sign in to continue." in English. French and Spanish use the same meaning when that language is active.
- Message body is not a JSON object with a string `text`, or `text` is empty or too long: HTTP 400. The widget shows "I can't retrieve that right now."
- Signing key is not usable, or the assistant cannot complete the turn: HTTP 503. The widget shows "I can't retrieve that right now."
- The widget stops waiting after 15 seconds. A timeout, a network error, any other non-success status, or a 200 body it cannot read also shows "I can't retrieve that right now." After three of those failures it pauses further calls for 30 seconds and shows the same line. HTTP 401 does not count toward that pause.

The current demo API allows browser calls only from `http://localhost:5173`, `http://localhost:5174`, and `http://localhost:5081`. Allowed request headers are `Authorization`, `Content-Type`, and `Accept`. Allowed methods are GET and POST.

## 6. What not to do

- Do not put the token or the signing secret in the widget script file, in `localStorage`, or in source control.
- Do not pass a tenant id as a config field, a query parameter, a header, or a message field. The page has no tenant field. The API will ignore one if you send it.
- Do not use your Entra ID, Okta, or other login token as the widget token. The widget token is the HS256 token your server creates for this API.
- Do not set `exp` more than 15 minutes after `iat`. Longer tokens are rejected.

## 7. Checklist

Fill DEV and PROD. Leave Done as `[ ]` until that row is finished. On the secret row, leave the placeholder. Do not replace it with the secret value.

| Item | DEV | PROD | Done |
| --- | --- | --- | --- |
| Widget script URL | | | [ ] |
| API base URL | | | [ ] |
| Your token endpoint URL | | | [ ] |
| Tenant id we assigned | | | [ ] |
| Key Vault secret name | [DON'T PUT SENSITIVE INFO HERE] | [DON'T PUT SENSITIVE INFO HERE] | [ ] |
| Test user id | | | [ ] |
| Brand name | | | [ ] |
| Primary color | | | [ ] |
| Preset | | | [ ] |
| Display (words or icon) | | | [ ] |
| Corner | | | [ ] |
| Locale | | | [ ] |
