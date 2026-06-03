# Module API

Internal module contracts for agent-readiness-kit. The published npm package exposes the `ark` CLI binary; these functions are the primary programmatic entry points when importing from source or tests.

## Audit

### `auditRepo(repoPath: string): Promise<AuditResult>`

**Module:** `src/audit/auditRepo.ts`

Runs all category checks against the resolved repository path and returns a finalized audit result.

### `finalizeAuditResult(repoPath, categories): AuditResult`

**Module:** `src/audit/scoring.ts`

Sums category scores (capped at 100), derives `missing` items and `recommendations` from findings.

## Reports

### `formatTerminalReport(result: AuditResult): string`

**Module:** `src/report/terminalReport.ts`

Human-readable colored summary for stdout.

### `formatAuditJson(result: AuditResult): string`

**Module:** `src/report/jsonReport.ts`

Pretty-printed JSON string for `--json` output.

### `formatMarkdownReport(result: AuditResult): string`

**Module:** `src/report/markdownReport.ts`

Markdown document for `--output` writes.

## Filesystem

### `writeFileSafe(filePath, content, options?): Promise<WriteResult>`

**Module:** `src/fs/writeFileSafe.ts`

Creates parent directories as needed. Returns `{ status: 'created' | 'overwritten' | 'skipped' }`. Skips when the file exists unless `options.force === true`.

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

Templates live in `src/generate/templates.ts` and intentionally retain starter placeholders for downstream repos.

## Config

| Function | Module | Purpose |
| --- | --- | --- |
| `loadArkrc(repoPath)` | `src/config/loadArkrc.ts` | Load optional `.arkrc` |
| `resolveAuditRunOptions(...)` | `src/config/loadArkrc.ts` | Merge audit CLI flags with config |
| `resolveInitOptions(...)` | `src/config/loadArkrc.ts` | Merge init options |
| `resolveGenerateOptions(...)` | `src/config/loadArkrc.ts` | Merge generate options |

## Category checks

Each check in `src/audit/checks/*` exports an async function `(repoPath: string) => Promise<CategoryResult>`:

- `checkAgentInstructions`
- `checkArchitecture`
- `checkWorkflow`
- `checkTesting`
- `checkSafety`
- `checkNavigability`
- `checkPromptAssets`
