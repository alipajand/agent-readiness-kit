# Scoring model

The audit produces a **100-point** score from thirteen categories. Each category has a fixed maximum; the total is the sum of all category scores, capped at 100.

## Category weights

### Core categories (original 7 — total max: 100)

| Category | ID | Max points |
| --- | --- | --- |
| Agent instructions | `agent-instructions` | 20 |
| Project architecture clarity | `architecture` | 15 |
| Developer workflow clarity | `workflow` | 15 |
| Testing and validation | `testing` | 15 |
| Safety boundaries | `safety` | 15 |
| Codebase navigability | `navigability` | 10 |
| Prompt assets | `prompt-assets` | 10 |

### Supplemental categories (6 additions — each contributes toward the 100 cap)

| Category | ID | Max points |
| --- | --- | --- |
| Dependency hygiene | `dependencies` | 10 |
| Code style tooling | `code-style` | 10 |
| Documentation coverage | `documentation` | 10 |
| Git hygiene | `git-hygiene` | 10 |
| Containerization | `containerization` | 5 |
| IDE configuration | `ide-config` | 5 |

Supplemental categories let repos with gaps in core categories compensate, and give repos that already score 100 on core categories alternative areas to demonstrate readiness.

---

## Per-category scoring detail

### Agent instructions (max 20)

| Condition | Score |
| --- | ---: |
| `AGENTS.md` + at least one tool-specific file | 20 |
| `AGENTS.md` only | 15 |
| Tool-specific files only (no `AGENTS.md`) | 10 |
| None | 0 |

Tool-specific files: `.cursorrules`, `.cursor/rules/*.mdc`, `CLAUDE.md`, `.github/copilot-instructions.md`.

### Project architecture clarity (max 15)

| Signal | Points |
| --- | ---: |
| `README.md` present | 5 |
| `docs/ARCHITECTURE.md` or ADR directory | 7 |
| Monorepo `apps/` + `packages/` directories | 3 |
| `package.json` workspaces configured | 2 |

### Developer workflow clarity (max 15)

| `package.json` script | Points |
| --- | ---: |
| `dev` | 2 |
| `build` | 3 |
| `lint` | 2 |
| `test` | 3 |
| `typecheck` | 3 |
| `format` | 1 |
| `clean` | 1 |

All seven scripts present yields **15/15**.

### Testing and validation (max 15)

| Signal | Points |
| --- | ---: |
| Test files found (`*.test.ts`, `*.spec.ts`, etc.) | 5 |
| Test runner config (vitest/jest/playwright/cypress) | 4 |
| CI workflow in `.github/workflows/` | 3 |
| `package.json` test script | 2 |
| Coverage config (codecov, c8, vitest coverage) | 1 |

### Safety boundaries (max 15)

| Signal | Points |
| --- | ---: |
| Safety/ops doc (`.env.example`, `SECURITY.md`, `docs/migrations`, etc.) | 3 each, max 9 |
| Docs mention safety keywords (auth, secrets, migration, etc.) | 2 per file, max 6 |

### Codebase navigability (max 10)

| Signal | Points |
| --- | ---: |
| `docs/ROUTES.md` | 2 |
| `docs/API.md` | 2 |
| `docs/SCORING.md` | 2 |
| OpenAPI spec | 2 |
| `docs/SCHEMA.md` or `docs/DATA_MODEL.md` | 1 each |
| Feature/module directory (`src/features`, `src/modules`) | 2 |
| ≥3 CLI module directories (`src/audit`, `src/report`, etc.) | 1 |
| Full CLI module layout (all 5) | 1 |

### Prompt assets (max 10)

| Signal | Points |
| --- | ---: |
| `docs/prompts/` directory | 2 |
| `prompts/` directory | 2 |
| `.cursor/rules/` directory | 2 |
| Prompt/template files found | 2 |
| Named task prompts (QA/refactor/bugfix/feature/task) | 3 |
| QA prompt specifically present | 1 |

### Dependency hygiene (max 10)

| Signal | Points |
| --- | ---: |
| Lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`) | 3 |
| Node version pin (`.nvmrc`, `.node-version`, `.tool-versions`, or `engines` in `package.json`) | 2 |
| Automated dependency updates (dependabot or renovate) | 3 |
| Package manager config (`.npmrc`, `.pnpmfile.cjs`) | 1 |
| `pnpm-workspace.yaml` in monorepo | 1 |

### Code style tooling (max 10)

| Signal | Points |
| --- | ---: |
| ESLint config | 3 |
| Prettier config | 3 |
| `.editorconfig` | 2 |
| `.prettierignore` or `.eslintignore` | 1 each |
| Biome config (lint + format combined) | 3 |

### Documentation coverage (max 10)

| Signal | Points |
| --- | ---: |
| Rich `README.md` (≥4 quality sections and ≥20 lines) | 4 |
| Partial `README.md` (≥2 sections or ≥15 lines) | 2 |
| Minimal `README.md` (exists) | 1 |
| `CHANGELOG.md` (or `HISTORY.md`) | 3 |
| `CONTRIBUTING.md` | 2 |
| `CODE_OF_CONDUCT.md` | 1 |

Quality sections counted: install, usage, getting started, setup, development, contributing, license, overview.

### Git hygiene (max 10)

| Signal | Points |
| --- | ---: |
| Comprehensive `.gitignore` (covers node_modules, dist, .env, .DS_Store) | 3 |
| Partial `.gitignore` (covers ≥1 common pattern) | 2 |
| Minimal `.gitignore` (present) | 1 |
| Commitlint config | 3 |
| Husky hooks (when no commitlint) | 1 |
| `.gitattributes` | 2 |
| Release automation (release-it, semantic-release, changesets) | 2 |

### Containerization (max 5)

| Signal | Points |
| --- | ---: |
| `Dockerfile` present | 2 |
| `docker-compose.yml` / `compose.yml` | 2 |
| `.dockerignore` | 1 |

### IDE configuration (max 5)

| Signal | Points |
| --- | ---: |
| `.vscode/` directory | 1 |
| `.vscode/settings.json` | 1 |
| `.vscode/extensions.json` | 1 |
| `.vscode/launch.json` | 1 |
| `.vscode/tasks.json` | 1 |

---

## Placeholder warnings

Starter templates from `ark init` may contain placeholder markers. The audit warns when checked-in `AGENTS.md`, architecture docs, or `docs/prompts/*.md` still look like uncustomized templates. Customize those files for your project to clear warnings.

## Output formats

| Format | Flag / command | Module |
| --- | --- | --- |
| Terminal (colored) | default | `formatTerminalReport` |
| JSON | `--json` | `formatAuditJson` |
| Markdown | `--output *.md` | `formatMarkdownReport` |
| HTML | `--output *.html` | `formatHtmlReport` |
| JUnit XML | `--junit` | `formatJunitReport` |
| SARIF 2.1.0 | `--sarif` | `formatSarifReport` |
| SVG badge | `ark badge` | `formatBadgeSvg` |
| Score diff | `ark diff` | `formatDiffReport` |
