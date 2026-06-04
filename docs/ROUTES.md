# CLI routes

The `ark` binary exposes a small command tree. All commands accept an optional `[repoPath]` argument (default: current directory).

## `ark audit [repoPath]`

Run the agent-readiness audit and print a terminal summary. Each run is appended to `.ark-history.json` in the repo root and a score delta (`▲/▼ N pts since last run`) is shown when history exists.

```bash
ark audit
ark audit /path/to/repo
pnpm dev audit
```

### Output flags

| Flag | Description |
|---|---|
| `--json` | Machine-readable JSON to stdout |
| `--junit` | JUnit XML to stdout (CI integration) |
| `--sarif` | SARIF JSON to stdout (GitHub code scanning) |
| `--output <path>` | Write `.md` or `.html` report to file |
| `--no-history` | Skip writing to `.ark-history.json` |

```bash
ark audit --json
ark audit --junit
ark audit --sarif
ark audit --output docs/report.md
ark audit --output docs/report.html
ark audit --no-history
```

## `ark check <category> [repoPath]`

Run a single audit category and print its findings. Useful for targeted checks without running all 13 categories.

Available category IDs: `agent-instructions`, `architecture`, `workflow`, `testing`, `safety`, `navigability`, `prompt-assets`, `dependencies`, `code-style`, `documentation`, `git-hygiene`, `containerization`, `ide-config`

```bash
ark check dependencies
ark check code-style --json
ark check testing /path/to/repo
```

## `ark diff <before.json> <after.json>`

Compare two audit JSON outputs and show score delta per category. Useful for tracking progress over time.

```bash
ark audit --json > before.json
# ... make improvements ...
ark audit --json > after.json
ark diff before.json after.json
```

## `ark badge [repoPath]`

Generate an SVG score badge to embed in your README. Color-coded: green (≥80), yellow-green (≥60), orange (≥40), red (<40).

```bash
ark badge                           # print SVG to stdout
ark badge --output badge.svg        # write to file
```

## `ark fix [repoPath]`

Run the audit and scaffold missing files for every failing check. Safe by default (skips existing files). Use `--force` to overwrite.

```bash
ark fix
ark fix --force
ark fix /path/to/repo
```

## `ark init [repoPath]`

Create starter agent-readiness files (`AGENTS.md`, `docs/ARCHITECTURE.md`, prompt templates). Skips files that already exist. Pass `--force` to overwrite.

```bash
ark init
ark init --force
pnpm dev init
```

## `ark generate cursor [repoPath]`

Generate `.cursor/rules/project.mdc`. Respects safe-write; use `--force` to overwrite.

```bash
ark generate cursor
pnpm dev generate cursor
```

## `ark generate codex [repoPath]`

Generate Codex-oriented starter files (`AGENTS.md` and a task prompt template).

```bash
ark generate codex
pnpm dev generate codex
```

## `ark generate claude [repoPath]`

Generate Claude Code starter files (`CLAUDE.md` and a task prompt template).

```bash
ark generate claude
pnpm dev generate claude
```

## `ark generate copilot [repoPath]`

Generate `.github/copilot-instructions.md` with agent boundaries and implementation rules.

```bash
ark generate copilot
pnpm dev generate copilot
```

## `ark generate github [repoPath]`

Scaffold a complete `.github/` structure: CI workflow, PR template, dependabot config, and issue templates.

```bash
ark generate github
ark generate github --force
```

## `ark generate vscode [repoPath]`

Generate `.vscode/settings.json`, `.vscode/extensions.json`, and `.vscode/launch.json`.

```bash
ark generate vscode
ark generate vscode --force
```

## Configuration

Optional `.arkrc` at the repository root sets defaults for audit output, init force, and generate force. CLI flags override `.arkrc` values.

### Where `.arkrc` is loaded from

Config lookup uses the CLI `[repoPath]` argument, not the directory selected later by `audit.repoPath`:

1. Resolve `[repoPath]` (default `.` → current working directory).
2. Load `.arkrc` from that directory if present.
3. Merge CLI flags with loaded config (`resolveAuditRunOptions`, etc.).
4. Resolve the final target repo (explicit `[repoPath]` wins over `audit.repoPath`; `audit.repoPath` applies only when `[repoPath]` is the default `.`).

Examples:

```bash
# Loads ./.arkrc; audits cwd (or audit.repoPath from ./.arkrc)
ark audit

# Loads /path/to/other/.arkrc; audits /path/to/other
# Does not read .arkrc from cwd
ark audit /path/to/other
```

Relative paths inside `.arkrc` (for example `audit.repoPath` or `audit.output`) are resolved from the **audited** repository root, not from the directory where `.arkrc` was loaded.
