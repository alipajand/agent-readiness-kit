# Module API

Internal module contracts for agent-readiness-kit. The published npm package exposes the `ark` CLI binary; these functions are the primary programmatic entry points when importing from source or tests.

## Audit

### `auditRepo(repoPath: string): Promise<AuditResult>`

**Module:** `src/audit/auditRepo.ts`

Runs all 13 category checks against the resolved repository path in parallel and returns a finalized audit result.

### `auditCategory(repoPath: string, categoryId: string): Promise<CategoryResult | null>`

**Module:** `src/audit/auditRepo.ts`

Runs a single category check by ID. Returns `null` when the ID is not recognized. Used by `ark check <category>`.

### `ALL_CHECK_IDS`

**Module:** `src/audit/auditRepo.ts`

`readonly` tuple of all registered category IDs in run order:

```
agent-instructions, architecture, workflow, testing, safety, navigability,
prompt-assets, dependencies, code-style, documentation, git-hygiene,
containerization, ide-config
```

### `finalizeAuditResult(repoPath, categories): AuditResult`

**Module:** `src/audit/scoring.ts`

Sums category scores (capped at 100), derives `missing` items and `recommendations` from findings.

## Reports

### `formatTerminalReport(result: AuditResult, scoreDelta?: number | null): string`

**Module:** `src/report/terminalReport.ts`

Human-readable colored summary for stdout. When `scoreDelta` is provided, shows a `(▲/▼ N pts since last run)` line alongside the score.

### `formatAuditJson(result: AuditResult): string`

**Module:** `src/report/jsonReport.ts`

Pretty-printed JSON string for `--json` output.

### `formatMarkdownReport(result: AuditResult): string`

**Module:** `src/report/markdownReport.ts`

Markdown document for `--output *.md` writes.

### `formatHtmlReport(result: AuditResult): string`

**Module:** `src/report/htmlReport.ts`

Self-contained HTML document for `--output *.html` writes. Includes inline CSS, a score gauge, category progress bars, and collapsible findings.

### `formatJunitReport(result: AuditResult): string`

**Module:** `src/report/junitReport.ts`

JUnit XML string for `--junit` output. Each category becomes a `<testsuite>`; each finding becomes a `<testcase>`. Failures map to `status: 'fail'`, warnings to `skipped`.

### `formatSarifReport(result: AuditResult): string`

**Module:** `src/report/sarifReport.ts`

SARIF 2.1.0 JSON for `--sarif` output. Each non-pass finding becomes a SARIF `result`; categories become tool `rules`.

### `formatBadgeSvg(result: AuditResult): string`

**Module:** `src/report/badgeReport.ts`

SVG badge string for `ark badge`. Color-coded: green (≥80), yellow-green (≥60), orange (≥40), red (<40).

### `computeDiff(before: AuditJson, after: AuditJson): DiffResult`

**Module:** `src/report/diffReport.ts`

Compares two audit JSON snapshots. Returns `scoreDelta`, per-category deltas, newly added categories, and removed categories.

### `formatDiffReport(diff: DiffResult): string`

**Module:** `src/report/diffReport.ts`

Colored terminal output for `ark diff`.

## Score history

### `appendHistory(repoPath: string, result: AuditResult): Promise<HistoryEntry>`

**Module:** `src/audit/history.ts`

Appends an entry to `.ark-history.json` in `repoPath`. Trims to 20 entries. Returns the entry written.

### `loadHistory(repoPath: string): Promise<AuditHistory>`

**Module:** `src/audit/history.ts`

Reads `.ark-history.json`; returns `{ entries: [] }` when missing.

### `getScoreDelta(history: AuditHistory, currentScore: number): number | null`

**Module:** `src/audit/history.ts`

Returns `currentScore - last entry score`, or `null` when history is empty.

## Filesystem

### `writeFileSafe(filePath, content, options?): Promise<WriteResult>`

**Module:** `src/fs/writeFileSafe.ts`

Creates parent directories as needed. Returns `{ status: 'created' | 'overwritten' | 'skipped' }`. Skips when the file exists unless `options.force === true`.

Used by `init` / `generate` with fixed paths under the repo. Does not validate that `filePath` stays inside a repository root — callers are responsible for path choice. `audit --output` writes via `writeFile` in `src/cli.ts` with the same trust model: relative paths under the audited repo, absolute paths anywhere the user can write.

### `readJsonFile<T>(filePath): Promise<T | null>`

**Module:** `src/fs/writeFileSafe.ts`

Reads and parses JSON; returns `null` on missing or invalid files.

## Generators

All generators accept `{ repoPath: string; force?: boolean }` and return `Promise<WriteResult[]>`.

| Function | Module | Writes |
| --- | --- | --- |
| `runInit` | `src/generate/initFiles.ts` | `AGENTS.md`, architecture doc, prompt templates |
| `generateCursor` | `src/generate/cursorFiles.ts` | `.cursor/rules/project.mdc` |
| `generateCodex` | `src/generate/codexFiles.ts` | Codex `AGENTS.md` and task prompt |
| `generateClaude` | `src/generate/claudeFiles.ts` | `CLAUDE.md` and task prompt |
| `generateCopilot` | `src/generate/copilotFiles.ts` | `.github/copilot-instructions.md` |
| `generateGithub` | `src/generate/githubFiles.ts` | CI workflow, PR template, dependabot config, issue templates |
| `generateVscode` | `src/generate/vscodeFiles.ts` | `.vscode/settings.json`, `extensions.json`, `launch.json` |
| `fixRepo` | `src/generate/fixRepo.ts` | Scaffolds whichever files correspond to failing audit checks |

Templates live in `src/generate/templates.ts` and intentionally retain starter placeholders for downstream repos.

## Config

| Function | Module | Purpose |
| --- | --- | --- |
| `loadArkrc(repoPath)` | `src/config/loadArkrc.ts` | Load optional `.arkrc` from `repoPath` |
| `resolveAuditRunOptions(...)` | `src/config/loadArkrc.ts` | Merge audit CLI flags with config |
| `resolveInitOptions(...)` | `src/config/loadArkrc.ts` | Merge init options |
| `resolveGenerateOptions(...)` | `src/config/loadArkrc.ts` | Merge generate options |

**Load order (audit):** `loadArkrc(resolveRepo(cliRepoArg))` runs first; `resolveAuditRunOptions(cliRepoArg, flags, arkrc)` runs second. The CLI `[repoPath]` selects which `.arkrc` file to read. `audit.repoPath` in that file redirects the audit target only when `[repoPath]` is the default `.`; an explicit CLI path overrides `audit.repoPath` and is also where config is loaded from.

## Category checks

Each check in `src/audit/checks/*` exports an async function `(repoPath: string) => Promise<CategoryResult>`:

### Core checks

- `checkAgentInstructions` — `AGENTS.md`, `.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, copilot instructions
- `checkArchitecture` — `README.md`, `docs/ARCHITECTURE.md`, ADR directory, monorepo layout
- `checkWorkflow` — `package.json` scripts (`dev`, `build`, `lint`, `test`, `typecheck`, `format`, `clean`)
- `checkTesting` — test files, test runner config, CI workflow, coverage config
- `checkSafety` — `.env.example`, `SECURITY.md`, docs mentioning security/auth/migration keywords
- `checkNavigability` — `docs/ROUTES.md`, `docs/API.md`, `docs/SCORING.md`, OpenAPI spec, module directories
- `checkPromptAssets` — `docs/prompts/`, `.cursor/rules/`, named task prompt files

### Supplemental checks

- `checkDependencies` — lockfile, `.nvmrc`/`.node-version`/`engines`, dependabot/renovate, `.npmrc`
- `checkCodeStyle` — ESLint config, Prettier config, `.editorconfig`, Biome
- `checkDocumentation` — README quality (sections + length), `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- `checkGitHygiene` — `.gitignore` quality, commitlint config, `.gitattributes`, release automation
- `checkContainerization` — `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- `checkIdeConfig` — `.vscode/settings.json`, `extensions.json`, `launch.json`, `tasks.json`
