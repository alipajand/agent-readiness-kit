# Agent instructions

## Project overview

**agent-readiness-kit** is a TypeScript Node.js CLI published as the `ark` binary. It audits a repository for readiness when AI coding agents (Cursor, Codex, Claude Code, Copilot, and similar tools) work in that codebase.

The tool runs entirely locally: no external API calls, no telemetry, no authentication, and no LLM calls. It reads files on disk, runs deterministic checks, and prints terminal, JSON, Markdown, HTML, JUnit, or SARIF reports.

Use `ark init`, `ark generate`, and `ark fix` to scaffold starter agent files. Generated writes use safe-write semantics and never overwrite existing files unless `--force` is passed.

## Architecture boundaries

Read `docs/ARCHITECTURE.md` before large changes. Respect module boundaries:

| Module              | Responsibility                                                      |
| ------------------- | ------------------------------------------------------------------- |
| `src/cli.ts`        | Commander command routing                                           |
| `src/audit/*`       | Audit orchestration, 13 category checks, and score history          |
| `src/config/*`      | `.arkrc` loading and validation                                     |
| `src/generate/*`    | Safe starter file generation (init, cursor, codex, claude, copilot, github, vscode, fix) |
| `src/report/*`      | Terminal, JSON, Markdown, HTML, JUnit, SARIF, badge, and diff formatters |
| `src/fs/*`          | Filesystem helpers (`writeFileSafe`, glob search)                   |
| `tests/*`           | Vitest coverage for checks and CLI behavior                         |

**Agent-editable areas:** audit checks, report formatting, generate templates, filesystem helpers, tests, and documentation under `docs/`.

**Human review required:** authentication, authorization, billing, telemetry, external network calls, breaking changes to the public CLI surface, and npm publish configuration.

## Commands

```bash
# Development
pnpm dev

# Build
pnpm build

# Lint / typecheck
pnpm lint
pnpm typecheck

# Format
pnpm format
pnpm format:check

# Tests
pnpm test

# Clean build artifacts
pnpm clean

# Run audit against this repo
pnpm dev audit
pnpm dev audit --json
pnpm dev audit --junit
pnpm dev audit --sarif
pnpm dev audit --output docs/agent-readiness-report.md
pnpm dev audit --output docs/agent-readiness-report.html

# Run a single audit category
pnpm dev check <category-id>

# Compare two audit snapshots
pnpm dev diff before.json after.json

# Generate SVG badge
pnpm dev badge --output badge.svg

# Scaffold missing files identified by audit
pnpm dev fix

# Generate specific tool files
pnpm dev generate copilot
pnpm dev generate github
pnpm dev generate vscode
```

## Testing expectations

- Run `pnpm test` (or the project test script) before finishing a task.
- Add or update tests when changing audit behavior, scoring, or file generation.
- Audit checks must remain deterministic and test-covered.
- Do not disable tests or skip CI checks without explicit approval.

## Forbidden changes without approval

- Authentication, authorization, or session handling
- Billing, payments, or subscription logic
- Security policies, secrets handling, or credential storage
- Telemetry, analytics, or external API integrations
- Database schema migrations in production paths
- Breaking public API contracts or renaming CLI commands

## Final report format

When completing a task, report:

1. Summary of changes
2. Files created or modified
3. Commands run (install, test, lint, build)
4. Test results
5. Known limitations or follow-ups
