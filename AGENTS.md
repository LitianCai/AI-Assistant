# AI Assistant

This repo is an embeddable multi-tenant B2B assistant. The founder is the decision maker. Decisions are **Locked**, **Direction**, or **Open**. The record is `documents/ai-assistant-product-strategies.md`. When the founder locks or changes a decision, use the `record-decision` skill. Read the record; do not re-decide what it already says.

## Assumptions

A choice the founder did not make is an assumption. Mark it in code with a comment that starts with [ASSUMED] and states the choice in one line. A small local choice (timing, a pixel breakpoint, an internal storage key, a preview-only string) may be implemented and marked.

Stop and ask the founder before writing code when the assumption affects security, tenancy, what the assistant tells the user, where conversation data is stored, retention, or the public embed contract (mountAiAssistant fields and the script the host loads). Do not invent that behavior and mark it afterward.

## Current code

The current code is the widget in `widget/` only. Do not start the .NET API, Azure resources, a second industry pack, or an onboarding studio unless the founder asks. Changes in `widget/` follow the `change-widget` skill.

## Preview and embed

From `widget/`:

- Preview: `npm run dev`
- Tests: `npm test`
- Build: `npm run build`

The embed file after build is `widget/dist/lib/ai-assistant.umd.js`. Host it later on Azure in Canada Central, from a hostname the founder controls. Do not put tokens or tenant ids in that file.

External sites load the UMD script and call `AiAssistant.mountAiAssistant(target, config)`.

Config fields:

- `token` (required, sent only as `Authorization: Bearer`)
- `apiBaseUrl`
- `preset`
- `display`
- `corner`
- `primaryColor`
- `brandName`
- `locale`

The browser never chooses the tenant.

## Locked first-build widget

- Option 1 standard panel (about 360px, 8px radius). Icon display is the same panel. The compact panel is not in the first build.
- Launcher shows words or an icon, never both. Minimum target 44px.
- Presets: `ask`, `help`, `question`, `chat`, `info`.
- Corner is configurable. Default is bottom-right. No drag.
- Greeting bubble: "How can I help you?". It is not a scale pulse.
- Placeholder: "Type a message".
- Suggested questions: "What can you do?" / "Help me find something" / "I have a question".
- Waiting state is generic "Working…".
- The answer appears a few words at a time only after the result is back, with its source.
- Cannot-answer: "I can't retrieve that right now." and "Sign in to continue."
- No Call us in the chrome.
- Languages: EN, FR, and ES. No language switcher inside the widget.
- Refresh restores the signed-in thread. Retain messages for 7 days.
- Client editing of the greeting, suggestions, and placeholder is later.

## Facts

Never invent order, price, invoice, or policy facts. The only preview fact is the exact question "Has order 10482 shipped?" The sample answer is "Order 10482 shipped on 28 Oct. 2 of 4 lines are still open." The source is Orders API.

## Rules

Always follow `.cursor/rules/`. Read the files. Do not paste them in place of reading them.

- `security-policy.mdc`
- `privacy-policy.mdc`
- `compliance-policy.mdc`
- `accessibility-policy.mdc`
- `foundry-tenancy.mdc`

One Foundry project later; isolation stays in the .NET API. Do not claim SOC 2. Canada first (PIPEDA, Quebec Law 25).

## Do not commit

Do not commit `node_modules`, `dist`, secrets, or the temporary helpers `documents/_*.py` and `documents/_*.txt`. Commit only when the founder asks.
