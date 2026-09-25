# agent-readiness-kit

A deterministic, local-first CLI that checks whether a repository is ready for AI coding agents — Cursor, Claude Code, Codex, GitHub Copilot, and other coding agents.

It scores the repository out of 100 across 13 categories: agent instruction files, architecture docs, scripts, tests, safety boundaries (including Claude Code permission settings), and more. It prints a terminal summary, writes optional JSON, JUnit, SARIF, Markdown, or HTML reports, and can gate CI with `--min-score`. Use `ark init`, `ark generate`, and `ark fix` to scaffold practical starter files, including least-privilege Claude Code settings.

It runs entirely on your machine: no telemetry, no network calls, no LLM calls. It's meant to make a repo safer and easier for agents to work in, and to complement human review — not replace it.

## Install

`ark` is not published to npm yet. **The npm package named `agent-readiness-kit` is an unrelated project**; installing it does not give you this tool and runs someone else's code. Install a release from GitHub instead (the CLI is built during install):

```bash
npm install -g github:alipajand/agent-readiness-kit#v1.0.0
# or, as a dev dependency
pnpm add -D github:alipajand/agent-readiness-kit#v1.0.0
```

Tags can be moved. To pin an exact version you have reviewed, use the tag's commit SHA instead of `v1.0.0`.

Or clone and build locally:

```bash
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

## Commands

### Audit

| Command                                      | Description                                             |
| -------------------------------------------- | ------------------------------------------------------- |
| `ark audit`                                  | Run audit, print terminal summary, record score history |
| `ark audit --json`                           | Machine-readable JSON on stdout                         |
| `ark audit --junit`                          | JUnit XML on stdout (CI integration)                    |
| `ark audit --sarif`                          | SARIF 2.1.0 JSON on stdout (GitHub code scanning)       |
| `ark audit --output report.md`               | Write Markdown report to file                           |
| `ark audit --output report.html`             | Write rich HTML report to file                          |
| `ark audit --no-history`                     | Skip writing to `.ark-history.json`                     |
| `ark check <category>`                       | Run a single audit category by ID                       |
| `ark diff before.json after.json`            | Compare two audit JSON outputs and show score delta     |
| `ark badge`                                  | Print SVG score badge to stdout                         |
| `ark badge --output badge.svg`               | Write SVG badge to file                                 |
| `ark fix`                                    | Scaffold missing files for every failing check          |
| `ark audit --output ../x.md --allow-outside` | Allow an `--output` path outside the audited repo       |
| `ark audit --min-score 70`                   | Exit with code 1 when the score is below 70 (CI gate)   |

### Generate

| Command                | Description                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `ark init`             | Create starter files (skip if present)                                                         |
| `ark generate cursor`  | Create `.cursor/rules/project.mdc`                                                             |
| `ark generate codex`   | Create `AGENTS.md` and Codex prompt template                                                   |
| `ark generate claude`  | Create `CLAUDE.md`, `.claude/settings.json`, a `/verify` command, and a Claude prompt template |
| `ark generate copilot` | Create `.github/copilot-instructions.md`                                                       |
| `ark generate github`  | Create CI workflow, PR template, dependabot config, issue templates                            |
| `ark generate vscode`  | Create `.vscode/settings.json`, `extensions.json`, `launch.json`                               |

Pass `--force` on any `init` or `generate` command to overwrite existing files.

`--output` path behavior: paths are resolved against the audited repo root, and anything that resolves outside it — `../` segments or an absolute path elsewhere — is rejected with a non-zero exit. Pass `--allow-outside` to opt out of the check. See [SECURITY.md](SECURITY.md#file-writes).

## Supported instruction files

The audit recognizes the instruction and prompt files that real repos use:

```text
AGENTS.md
CLAUDE.md
claude.md
.claude/CLAUDE.md
.claude/claude.md
.claude/commands/*.md
.claude/agents/**/*.md
.claude/skills/**/SKILL.md
.claude/rules/**/*.md
.cursorrules
.cursor/rules/*.mdc
.github/copilot-instructions.md
docs/prompts/**/*.md
prompts/**/*.md
```

A few notes on Claude Code files:

- `CLAUDE.md` at the repo root is the recommended Claude Code file, and `ark generate claude` always creates that canonical root file. It imports `AGENTS.md` with `@AGENTS.md`, and the generated `.claude/settings.json` pre-approves nothing and denies `.env` reads and destructive commands.
- Subagents (`.claude/agents/`), skills (`.claude/skills/*/SKILL.md`), and rules (`.claude/rules/`) count as Claude context too.
- A committed `.claude/settings.json` affects the safety score. Denying `.env` reads adds points. `bypassPermissions` or an allow rule for any `Bash` command costs points.
- Lowercase and nested Claude files (`claude.md`, `.claude/CLAUDE.md`, `.claude/claude.md`, `.claude/commands/*.md`) are recognized too, because real repos use them. If only a lowercase `claude.md` is present, the audit suggests renaming it to `CLAUDE.md`.
- `.claude/commands/*.md` count as useful Claude context, but they don't replace a root `CLAUDE.md`.

## Score history

Each `ark audit` run appends an entry to `.ark-history.json` in the repo root (capped at 20 entries). The terminal summary shows a delta line like `(▲ +7 since last run)`. Pass `--no-history` to skip writing history.

## `.arkrc` (optional)

Place a JSON file named `.arkrc` at the repository root to set defaults. CLI flags and arguments override `.arkrc`.

```json
{
  "audit": {
    "repoPath": ".",
    "json": false,
    "output": "docs/agent-readiness-report.md",
    "minScore": 70
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

### Config lookup order

`ark` loads `.arkrc` from the CLI `[repoPath]` argument (default: current working directory), **before** applying `audit.repoPath` (or `init.repoPath` / `generate.repoPath`) from that file.

| Command                   | Which `.arkrc` is loaded | Target repo                                                               |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `ark audit` (no path arg) | `.arkrc` in cwd          | `audit.repoPath` from that file, or cwd if omitted                        |
| `ark audit ../other`      | `.arkrc` in `../other`   | `../other` — explicit path wins; `audit.repoPath` in that file is ignored |

The same lookup rule applies to `init` and `generate`.

## Sample output

```text
Repository: /path/to/repo

Agent Readiness Score: 68 / 100  (▲ +7 since last run)

Category scores:
  Agent instructions: 15/20
  Project architecture clarity: 12/15
  Developer workflow clarity: 13/15
  Testing and validation: 10/15
  Safety boundaries: 9/15
  Codebase navigability: 5/10
  Prompt assets: 4/10
  Dependency hygiene: 8/10
  Code style tooling: 7/10
  Documentation coverage: 6/10
  Git hygiene: 5/10
  Containerization: 0/5
  IDE configuration: 2/5

Strong:
  ✓ README.md found
  ✓ Test files found (12)
  ✓ pnpm-lock.yaml present
  ✓ ESLint config found

Missing:
  ✗ AGENTS.md
  ✗ .env.example

Recommended next actions:
  1. Add AGENTS.md with project overview, commands, and agent boundaries
  2. Add docs/ARCHITECTURE.md describing system boundaries
```

## Scoring (100 points)

The score is the sum of all category scores, capped at 100. The first seven categories form the core 100-point budget; the six supplemental categories let repos compensate for gaps or demonstrate additional readiness.

### Core categories

| Category                     | Max points |
| ---------------------------- | ---------: |
| Agent instructions           |         20 |
| Project architecture clarity |         15 |
| Developer workflow clarity   |         15 |
| Testing and validation       |         15 |
| Safety boundaries            |         15 |
| Codebase navigability        |         10 |
| Prompt assets                |         10 |

### Supplemental categories

| Category               | Max points |
| ---------------------- | ---------: |
| Dependency hygiene     |         10 |
| Code style tooling     |         10 |
| Documentation coverage |         10 |
| Git hygiene            |         10 |
| Containerization       |          5 |
| IDE configuration      |          5 |

Agent instructions scoring:

- **20** — `AGENTS.md` plus at least one tool-specific file (any Cursor, Claude, or Copilot file)
- **15** — `AGENTS.md` only
- **10** — tool-specific only
- **0** — none

Tool-specific files include `.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, `claude.md`, `.claude/CLAUDE.md`, `.claude/claude.md`, `.claude/commands/*.md`, and `.github/copilot-instructions.md`.

See [docs/SCORING.md](docs/SCORING.md) for full category breakdowns.

## Related tools

- [agent-context-doctor](https://github.com/alipajand/agent-context-doctor) — checks whether agent instruction files are specific, safe, and usable.
- [agent-pr-reviewer-lite](https://github.com/alipajand/agent-pr-reviewer-lite) — flags risky PR diffs before merge.
- [agent-readiness-action](https://github.com/alipajand/agent-readiness-action) — runs readiness audits in GitHub Actions.

## Non-goals

- No LLM or external API calls
- No telemetry or authentication
- Does not replace human code review
- No guarantee that agents will perform well in your repo

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
