---
name: record-decision
description: >-
  Updates documents/ai-assistant-product-strategies.md in place when the founder locks or changes a product decision.
  Use when the founder sets a decision to Locked, Direction, or Open, or asks to record a product decision.
---

# Record a product decision

The founder is the decision maker. The record is `documents/ai-assistant-product-strategies.md`. Status is only Locked, Direction, or Open.

## Update in place

1. Edit the existing Markdown file. Do not create a new document.
2. Leave the first table alone. It is the status legend under "How to read status".
3. The summary is the second table: Topic, Status, Statement. Body decisions are lines that begin with `- **Locked.**`, `- **Direction.**`, or `- **Open.**`
4. Find the matching topic in that table and in the body. Change the status and statement in the existing lines.
5. A new decision is a new bullet in the matching section, plus a new row in the summary table. Do not delete other decisions.
6. If the match is ambiguous or missing, stop and say so. Do not rebuild the file.
7. Save over the same path.

## Afterward

Delete the temporary script after a successful save. Do not leave `documents/_*.py` or `documents/_*.txt` behind. Do not commit unless the founder asks.
