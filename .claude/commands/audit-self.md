---
description: Run ark audit against this repository and explain the scores
allowed-tools: Bash(pnpm dev audit:*)
---

Run `pnpm dev audit . --json --no-history` and summarize: the total score, each category below
its maximum with the findings that cost points, and the missing items. Do not change any files
and do not write `.ark-history.json`.
