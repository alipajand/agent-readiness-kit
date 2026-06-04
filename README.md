# agent-readiness-kit

Audit whether a software repository is ready for AI coding agents (Cursor, Codex, Claude Code, GitHub Copilot, and similar tools).

The CLI inspects repo structure, configuration, documentation, scripts, tests, and agent instruction files, then produces a terminal summary, optional JSON, Markdown, or HTML report. Use `ark init`, `ark generate`, and `ark fix` to scaffold practical starter files.

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

## Commands

### Audit

| Command | Description |
| --- | --- |
| `ark audit` | Run audit, print terminal summary, record score history |
| `ark audit --json` | Machine-readable JSON on stdout |
| `ark audit --junit` | JUnit XML on stdout (CI integration) |
| `ark audit --sarif` | SARIF 2.1.0 JSON on stdout (GitHub code scanning) |
| `ark audit --output report.md` | Write Markdown report to file |
| `ark audit --output report.html` | Write rich HTML report to file |
| `ark audit --no-history` | Skip writing to `.ark-history.json` |
| `ark check <category>` | Run a single audit category by ID |
| `ark diff before.json after.json` | Compare two audit JSON outputs and show score delta |
| `ark badge` | Print SVG score badge to stdout |
| `ark badge --output badge.svg` | Write SVG badge to file |
| `ark fix` | Scaffold missing files for every failing check |

### Generate

| Command | Description |
| --- | --- |
| `ark init` | Create starter files (skip if present) |
| `ark generate cursor` | Create `.cursor/rules/project.mdc` |
| `ark generate codex` | Create `AGENTS.md` and Codex prompt template |
| `ark generate claude` | Create `CLAUDE.md` and Claude prompt template |
| `ark generate copilot` | Create `.github/copilot-instructions.md` |
| `ark generate github` | Create CI workflow, PR template, dependabot config, issue templates |
| `ark generate vscode` | Create `.vscode/settings.json`, `extensions.json`, `launch.json` |

Pass `--force` on any `init` or `generate` command to overwrite existing files.

`audit --output` path behavior: relative paths are resolved under the audited repo; absolute paths can write anywhere the CLI user can write. See [SECURITY.md](SECURITY.md#file-writes).

## Score history

Each `ark audit` run appends an entry to `.ark-history.json` in the repo root (capped at 20 entries). The terminal summary shows a delta line like `(▲ +7 since last run)`. Pass `--no-history` to skip writing history.

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

### Config lookup order

`ark` loads `.arkrc` from the CLI `[repoPath]` argument (default: current working directory), **before** applying `audit.repoPath` (or `init.repoPath` / `generate.repoPath`) from that file.

| Command | Which `.arkrc` is loaded | Target repo |
| --- | --- | --- |
| `ark audit` (no path arg) | `.arkrc` in cwd | `audit.repoPath` from that file, or cwd if omitted |
| `ark audit ../other` | `.arkrc` in `../other` | `../other` — explicit path wins; `audit.repoPath` in that file is ignored |

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

| Category | Max points |
| --- | ---: |
| Agent instructions | 20 |
| Project architecture clarity | 15 |
| Developer workflow clarity | 15 |
| Testing and validation | 15 |
| Safety boundaries | 15 |
| Codebase navigability | 10 |
| Prompt assets | 10 |

### Supplemental categories

| Category | Max points |
| --- | ---: |
| Dependency hygiene | 10 |
| Code style tooling | 10 |
| Documentation coverage | 10 |
| Git hygiene | 10 |
| Containerization | 5 |
| IDE configuration | 5 |

Agent instructions scoring:

- **20** — `AGENTS.md` plus at least one tool-specific file (`.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, `.github/copilot-instructions.md`)
- **15** — `AGENTS.md` only
- **10** — tool-specific only
- **0** — none

See [docs/SCORING.md](docs/SCORING.md) for full category breakdowns.

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
