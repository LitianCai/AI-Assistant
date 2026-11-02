---
name: change-widget
description: >-
  Changes the embeddable assistant in widget/ while keeping the embed contract and locked first-build behavior.
  Use when editing widget source, styles, tests, the preview, or AiAssistant.mountAiAssistant.
---

# Change the widget

Read these before editing `widget/`:

- `AGENTS.md`
- `.cursor/rules/accessibility-policy.mdc`
- `.cursor/rules/security-policy.mdc`

## Keep

- External sites load `widget/dist/lib/ai-assistant.umd.js` and call `AiAssistant.mountAiAssistant(target, config)`.
- Config fields: `token` (required, sent only as `Authorization: Bearer`), `apiBaseUrl`, `preset`, `display`, `corner`, `primaryColor`, `brandName`, `locale`.
- The browser never chooses the tenant. Do not put tokens or tenant ids in the embed file.
- Locked first-build behavior in `AGENTS.md`: option 1 standard panel (about 360px, 8px radius), icon display as the same panel, launcher words or icon (never both, at least 44px), and the fixed chrome copy.

## Do not add

- A language switcher
- Call us in the chrome
- A compact panel
- A tenant id from the browser

## Assumptions

Mark a choice the founder did not make with a one-line `[ASSUMED]` comment. Small local choices (timing, a pixel breakpoint, an internal storage key, a preview-only string) may be implemented and marked. Stop and ask before writing code when the assumption affects security, tenancy, what the assistant tells the user, where conversation data is stored, retention, or the public embed contract (`mountAiAssistant` fields and the host script). Do not invent that behavior and mark it afterward.

## Check

From `widget/`, run `npm test` and `npm run build`. Both must pass. Do not commit unless the founder asks. Do not commit `node_modules`, `dist`, or secrets.
