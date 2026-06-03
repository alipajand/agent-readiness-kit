# CLI routes

The `ark` binary exposes a small command tree. All commands accept an optional `[repoPath]` argument (default: current directory).

## `ark audit [repoPath]`

Run the agent-readiness audit and print a terminal summary.

```bash
ark audit
ark audit /path/to/repo
pnpm dev audit
```

## `ark audit --json [repoPath]`

Print machine-readable JSON to stdout (score, categories, findings, missing items, recommendations). Status messages (for example report write confirmations) go to stderr so stdout stays parseable when combined with `--output`.

```bash
ark audit --json
pnpm dev audit --json
```

## `ark audit --output <path> [repoPath]`

Write a Markdown report to `<path>` and print a short confirmation on stderr. When `--json` is not set, the terminal summary still prints on stdout after the write.

**Path behavior:** relative paths are resolved under the audited repository root. Absolute paths are written as given and can target locations outside the repo. There is no sandbox; the CLI user controls where files are written.

```bash
ark audit --output docs/agent-readiness-report.md
pnpm dev audit --output docs/agent-readiness-report.md
ark audit --json --output docs/agent-readiness-report.md
ark audit --output /tmp/agent-readiness-report.md
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
