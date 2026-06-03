# Architecture

## System context

agent-readiness-kit solves a local documentation and structure problem: AI coding agents work best when a repository exposes clear instructions, architecture, scripts, tests, safety boundaries, navigability docs, and reusable prompts.

The CLI has no runtime server, database, or network dependencies beyond reading the local filesystem. All audit results are computed deterministically from repo contents.

## Major components

| Path                                | Role                                                                                                                    |
|-------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `src/cli.ts`                        | Commander entrypoint; routes `audit`, `init`, and `generate` subcommands                                                |
| `src/audit/auditRepo.ts`            | Runs all category checks and finalizes the 100-point score                                                              |
| `src/audit/checks/*`                | Individual category auditors (agent instructions, architecture, workflow, testing, safety, navigability, prompt assets) |
| `src/audit/scoring.ts`              | Score aggregation, missing items, and recommendations                                                                   |
| `src/audit/placeholderDetection.ts` | Detects starter-template placeholders in checked-in docs                                                                |
| `src/config/*`                      | Loads and validates optional `.arkrc`; merges CLI flags with config                                                     |
| `src/generate/*`                    | Writes starter files via `writeFileSafe` (skip unless `--force`)                                                        |
| `src/report/*`                      | Formats audit output for terminal, JSON, and Markdown                                                                   |
| `src/fs/*`                          | `writeFileSafe`, glob helpers, existence checks                                                                         |
| `tests/*`                           | Vitest specs for checks, reports, config, and generation                                                                |

## Boundaries

- **Agent-editable modules:** `src/audit`, `src/generate`, `src/report`, `src/config`, `src/fs`, and matching tests.
- **Requires human review:** auth, billing, telemetry, external APIs, npm publish settings, and CLI command renames.

## Data flow

```
CLI command
  → load .arkrc from resolved CLI [repoPath] (default: cwd)
  → merge CLI flags with .arkrc (section repoPath applies only when [repoPath] is ".")
  → resolve final target repo path
  → audit action OR generate action
  → report formatting OR safe file writes
  → stdout and/or written report path
```

**Audit path:** `auditRepo(repoPath)` runs category checks in parallel, sums scores (max 100), and returns missing items plus recommendations.

**Generate path:** `runInit` / `generateCursor` / `generateCodex` / `generateClaude` call `writeFileSafe` for each target file. Existing files are skipped unless `--force`.

## Related docs

- `docs/ROUTES.md` — CLI command reference
- `docs/API.md` — module contracts and exported functions
- `docs/SCORING.md` — 100-point scoring model
