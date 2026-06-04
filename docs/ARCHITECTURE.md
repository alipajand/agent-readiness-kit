# Architecture

## System context

agent-readiness-kit solves a local documentation and structure problem: AI coding agents work best when a repository exposes clear instructions, architecture, scripts, tests, safety boundaries, navigability docs, and reusable prompts.

The CLI has no runtime server, database, or network dependencies beyond reading the local filesystem. All audit results are computed deterministically from repo contents.

## Major components

| Path | Role |
| --- | --- |
| `src/cli.ts` | Commander entrypoint; routes `audit`, `check`, `diff`, `badge`, `fix`, `init`, and `generate` subcommands |
| `src/audit/auditRepo.ts` | Runs all 13 category checks in parallel, exposes `auditCategory` for single-check runs, and finalizes the 100-point score |
| `src/audit/checks/*` | Individual category auditors — 7 core + 6 supplemental (see below) |
| `src/audit/scoring.ts` | Score aggregation, missing items, and recommendations |
| `src/audit/history.ts` | Reads/writes `.ark-history.json`; computes score deltas |
| `src/audit/placeholderDetection.ts` | Detects starter-template placeholders in checked-in docs |
| `src/config/*` | Loads and validates optional `.arkrc`; merges CLI flags with config |
| `src/generate/*` | Writes starter files via `writeFileSafe` (skip unless `--force`) |
| `src/report/*` | Formats audit output for terminal, JSON, Markdown, HTML, JUnit, SARIF, SVG badge, and diff |
| `src/fs/*` | `writeFileSafe`, glob helpers, existence checks |
| `tests/*` | Vitest specs for checks, reports, config, and generation |

## Audit checks

### Core (original 7 — 100-point budget)

| Check | ID | Max |
| --- | --- | --- |
| `checkAgentInstructions` | `agent-instructions` | 20 |
| `checkArchitecture` | `architecture` | 15 |
| `checkWorkflow` | `workflow` | 15 |
| `checkTesting` | `testing` | 15 |
| `checkSafety` | `safety` | 15 |
| `checkNavigability` | `navigability` | 10 |
| `checkPromptAssets` | `prompt-assets` | 10 |

### Supplemental (6 additions — contribute toward 100 cap)

| Check | ID | Max |
| --- | --- | --- |
| `checkDependencies` | `dependencies` | 10 |
| `checkCodeStyle` | `code-style` | 10 |
| `checkDocumentation` | `documentation` | 10 |
| `checkGitHygiene` | `git-hygiene` | 10 |
| `checkContainerization` | `containerization` | 5 |
| `checkIdeConfig` | `ide-config` | 5 |

## Report formats

| Format | Trigger | Module |
| --- | --- | --- |
| Terminal (colored) | default | `src/report/terminalReport.ts` |
| JSON | `--json` | `src/report/jsonReport.ts` |
| Markdown | `--output *.md` | `src/report/markdownReport.ts` |
| HTML | `--output *.html` | `src/report/htmlReport.ts` |
| JUnit XML | `--junit` | `src/report/junitReport.ts` |
| SARIF 2.1.0 | `--sarif` | `src/report/sarifReport.ts` |
| SVG badge | `ark badge` | `src/report/badgeReport.ts` |
| Diff (terminal) | `ark diff` | `src/report/diffReport.ts` |

## Boundaries

- **Agent-editable modules:** `src/audit`, `src/generate`, `src/report`, `src/config`, `src/fs`, and matching tests.
- **Requires human review:** auth, billing, telemetry, external APIs, npm publish settings, and CLI command renames.

## Data flow

```
CLI command
  → load .arkrc from resolved CLI [repoPath] (default: cwd)
  → merge CLI flags with .arkrc (section repoPath applies only when [repoPath] is ".")
  → resolve final target repo path
  → audit action OR generate/fix action
  → report formatting OR safe file writes
  → stdout and/or written report path
```

**Audit path:** `auditRepo(repoPath)` runs all 13 category checks in parallel, sums scores (max 100), returns missing items plus recommendations. Score history is appended to `.ark-history.json`; delta is shown in terminal output.

**Single-check path:** `auditCategory(repoPath, id)` runs exactly one check. Used by `ark check <category>`.

**Diff path:** `ark diff <before.json> <after.json>` reads two JSON files, calls `computeDiff`, and prints `formatDiffReport`.

**Badge path:** `ark badge` runs `auditRepo`, calls `formatBadgeSvg`, writes or prints the SVG.

**Fix path:** `ark fix` runs `auditRepo`, inspects failing findings, and calls the appropriate generators (`runInit`, `generateCopilot`, `generateGithub`) to scaffold missing files.

**Generate path:** `runInit` / `generateCursor` / `generateCodex` / `generateClaude` / `generateCopilot` / `generateGithub` / `generateVscode` call `writeFileSafe` for each target file. Existing files are skipped unless `--force`.

## Related docs

- `docs/ROUTES.md` — CLI command reference
- `docs/API.md` — module contracts and exported functions
- `docs/SCORING.md` — 100-point scoring model
- `docs/MIGRATIONS.md` — breaking change history and upgrade guide
