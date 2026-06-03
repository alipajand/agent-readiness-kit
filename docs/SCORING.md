# Scoring model

The audit produces a **100-point** score from seven categories. Each category has a fixed maximum; the total is the sum of category scores (capped at 100).

## Category weights

| Category | ID | Max points |
| --- | --- | --- |
| Agent instructions | `agent-instructions` | 20 |
| Project architecture clarity | `architecture` | 15 |
| Developer workflow clarity | `workflow` | 15 |
| Testing and validation | `testing` | 15 |
| Safety boundaries | `safety` | 15 |
| Codebase navigability | `navigability` | 10 |
| Prompt assets | `prompt-assets` | 10 |

## Workflow script scoring

The workflow category awards up to **15** points from `package.json` scripts:

| Script | Points |
| --- | --- |
| `dev` | 2 |
| `build` | 3 |
| `lint` | 2 |
| `test` | 3 |
| `typecheck` | 3 |
| `format` | 1 |
| `clean` | 1 |

All seven scripts present yields **15/15**.

## Navigability signals

The navigability check rewards documented CLI/API/scoring references and clear module layout (see `src/audit/checks/navigability.ts`). Examples:

- `docs/ROUTES.md`, `docs/API.md`, `docs/SCORING.md`
- Optional `docs/SCHEMA.md`, `docs/DATA_MODEL.md`, OpenAPI specs
- Structured source directories such as `src/audit`, `src/generate`, `src/report`, `src/config`, `src/fs`

Repos without web routes can still score meaningfully when CLI and module docs exist.

## Placeholder warnings

Starter templates from `ark init` may contain placeholder markers. The audit warns when checked-in `AGENTS.md`, architecture docs, or `docs/prompts/*.md` still look like uncustomized templates. Customize those files for your project to clear warnings.

## Output

- Terminal: colored summary via `formatTerminalReport`
- JSON: `--json` via `formatAuditJson`
- Markdown: `--output <path>` via `formatMarkdownReport`
