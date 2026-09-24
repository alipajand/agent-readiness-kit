@AGENTS.md

## Claude Code

AGENTS.md above is the source of truth. This file only adds what is specific to Claude Code.

- `/verify` runs the required checks and reports the results.
- `/audit-self` runs `ark audit` against this repository and explains the scores.
- The `security-reviewer` subagent reviews a diff against the safe-write and untrusted-input rules
  (confined writes, no symlink following, `.arkrc` confinement, escaped output). Use it before
  finishing changes under `src/fs/`, `src/generate/`, `src/audit/history.ts`, `src/config/`,
  `src/report/`, or `src/cli.ts`.
- The `adding-an-audit-check` skill walks through adding a scored check end to end.
- `.claude/settings.json` allows the project's pnpm scripts and read-only git commands, asks
  before pushing, and denies reading `.env` files and running network or destructive commands.
  Personal overrides go in `.claude/settings.local.json`, which is not committed.
