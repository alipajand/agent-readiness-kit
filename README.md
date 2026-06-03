# agent-readiness-kit

Audit whether a software repository is ready for AI coding agents (Cursor, Codex, Claude Code, GitHub Copilot, and similar tools).

The CLI inspects repo structure, configuration, documentation, scripts, tests, and agent instruction files, then produces a terminal summary, optional JSON, and an optional Markdown report. Use `ark init` and `ark generate` to scaffold practical starter files.

## Install

```bash
pnpm add -D agent-readiness-kit
# or clone and link locally
pnpm install
pnpm build
```

Global use after build:

```bash
pnpm link --global
ark audit
```

Local development:

```bash
pnpm install
pnpm dev audit
```

`pnpm dev audit` is read-only (terminal summary only). To write a Markdown report in this repo:

```bash
pnpm dev audit --output docs/agent-readiness-report.md
```

## Commands

| Command                                             | Description                                   |
| --------------------------------------------------- | --------------------------------------------- |
| `ark audit`                                         | Run audit and print terminal summary          |
| `ark audit --json`                                  | Machine-readable JSON on stdout               |
| `ark audit --output docs/agent-readiness-report.md` | Write Markdown report                         |
| `ark init`                                          | Create starter files (skip if present)        |
| `ark generate cursor`                               | Create `.cursor/rules/project.mdc`            |
| `ark generate codex`                                | Create `AGENTS.md` and Codex prompt template  |
| `ark generate claude`                               | Create `CLAUDE.md` and Claude prompt template |

Pass `--force` on `init` or `generate` to overwrite existing files.

`audit --output` writes a Markdown report to the path you give. Relative paths are under the audited repo; absolute paths (for example `/tmp/report.md`) can write outside it. See [SECURITY.md](SECURITY.md#file-writes).

## `.arkrc` (optional)

Place a JSON file named `.arkrc` at the repository root to set defaults. CLI flags and arguments override `.arkrc`.

```json
{
  "audit": {
    "repoPath": ".",
    "json": false,
    "output": "docs/agent-readiness-report.md"
  },
  "init": {
    "force": false,
    "repoPath": "."
  },
  "generate": {
    "force": false,
    "repoPath": "."
  }
}
```

Only include the sections you need. Invalid `.arkrc` files cause the command to exit with an error.

This repository keeps `"audit": {}` so a plain `ark audit` does not write files; pass `--output` when you want a Markdown report.

### Config lookup order

`ark` loads `.arkrc` from the CLI `[repoPath]` argument (default: current working directory), **before** applying `audit.repoPath` (or `init.repoPath` / `generate.repoPath`) from that file.

| Command                   | Which `.arkrc` is loaded | Target repo                                                               |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `ark audit` (no path arg) | `.arkrc` in cwd          | `audit.repoPath` from that file, or cwd if omitted                        |
| `ark audit ../other`      | `.arkrc` in `../other`   | `../other` — explicit path wins; `audit.repoPath` in that file is ignored |

The same lookup rule applies to `init` and `generate`.

**Typical pattern:** keep `.arkrc` in the repo you run commands from and omit the path argument; use `audit.repoPath` only when you want defaults to target another directory without passing it every time.

**Surprise to avoid:** `ark audit ../other` does **not** load cwd’s `.arkrc`. It loads config from the passed repo only.

## Sample output

```text
Repository: /path/to/repo

Agent Readiness Score: 68 / 100

Category scores:
  Agent instructions: 15/20
  Project architecture clarity: 12/15
  ...

Strong:
  ✓ README.md found
  ✓ Test files found (12)

Missing:
  ✗ AGENTS.md
  ✗ .env.example

Recommended next actions:
  1. Add AGENTS.md with project overview, commands, and agent boundaries
  2. Add docs/ARCHITECTURE.md describing system boundaries
```

## Scoring (100 points)

| Category                     | Points |
| ---------------------------- | -----: |
| Agent instructions           |     20 |
| Project architecture clarity |     15 |
| Developer workflow clarity   |     15 |
| Testing and validation       |     15 |
| Safety boundaries            |     15 |
| Codebase navigability        |     10 |
| Prompt assets                |     10 |

Agent instructions scoring:

- **20** — `AGENTS.md` plus at least one tool-specific file (`.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, `.github/copilot-instructions.md`)
- **15** — `AGENTS.md` only
- **10** — tool-specific only
- **0** — none

## Non-goals

- No LLM or external API calls
- No telemetry or authentication
- Does not replace human code review
- No guarantee that agents will perform well in your repo

## Roadmap

- Category weight overrides in `.arkrc`
- Language-specific check packs (Python, Go, Rust)
- CI GitHub Action wrapper
- SARIF export for CI dashboards

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm dev audit
```

## Security

See [SECURITY.md](SECURITY.md) for supported versions, vulnerability reporting, and scope.

Report security issues privately via [GitHub Security Advisories](https://github.com/alipajand/agent-readiness-kit/security/advisories/new) — do not open a public issue for undisclosed vulnerabilities.

## License

MIT
