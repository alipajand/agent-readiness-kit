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

Print machine-readable JSON to stdout (score, categories, findings, missing items, recommendations).

```bash
ark audit --json
pnpm dev audit --json
```

## `ark audit --output <path> [repoPath]`

Write a Markdown report to `<path>` and print a short confirmation. When `.arkrc` sets a default output path, the terminal summary may still print after the write.

```bash
ark audit --output docs/agent-readiness-report.md
pnpm dev audit --output docs/agent-readiness-report.md
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

Optional `.arkrc` at the repo root sets defaults for audit output, init force, and generate force. CLI flags override `.arkrc` values.
