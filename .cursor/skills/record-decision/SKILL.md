---
name: record-decision
description: >-
  Updates documents/ai-assistant-product-strategies.docx in place when the founder locks or changes a product decision.
  Use when the founder sets a decision to Locked, Direction, or Open, or asks to record a product decision.
---

# Record a product decision

The founder is the decision maker. The record is `documents/ai-assistant-product-strategies.docx`. Status is only Locked, Direction, or Open.

## Update in place

1. Open the existing file with python-docx. Do not create a new document.
2. Leave the first table alone. It is the status legend.
3. The summary is the second table: Topic, Status, Statement. Body decisions are Normal paragraphs that begin with `Locked.`, `Direction.`, or `Open.`
4. Find the matching topic in that table and in the body. Change the status and statement in the existing text runs.
5. A new decision is a cloned neighboring paragraph in the matching section, plus a cloned row in the summary table. Set its text. Do not delete other decisions.
6. If the match is ambiguous or missing, stop and say so. Do not rebuild the file.
7. Save over the same path.

## Afterward

Delete the temporary script after a successful save. Do not leave `documents/_*.py` or `documents/_*.txt` behind. Do not commit unless the founder asks.
