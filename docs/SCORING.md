# Scoring model

The audit produces a **100-point** score from thirteen categories. Each category has a fixed maximum; the total is the sum of all category scores, capped at 100.

## Category weights

### Core categories (original 7 — total max: 100)

| Category                     | ID                   | Max points |
| ---------------------------- | -------------------- | ---------- |
| Agent instructions           | `agent-instructions` | 20         |
| Project architecture clarity | `architecture`       | 15         |
| Developer workflow clarity   | `workflow`           | 15         |
| Testing and validation       | `testing`            | 15         |
| Safety boundaries            | `safety`             | 15         |
| Codebase navigability        | `navigability`       | 10         |
| Prompt assets                | `prompt-assets`      | 10         |

### Supplemental categories (6 additions — each contributes toward the 100 cap)

| Category               | ID                 | Max points |
| ---------------------- | ------------------ | ---------- |
| Dependency hygiene     | `dependencies`     | 10         |
| Code style tooling     | `code-style`       | 10         |
| Documentation coverage | `documentation`    | 10         |
| Git hygiene            | `git-hygiene`      | 10         |
| Containerization       | `containerization` | 5          |
| IDE configuration      | `ide-config`       | 5          |

Supplemental categories let repos with gaps in core categories compensate, and give repos that already score 100 on core categories alternative areas to demonstrate readiness.

---

## Ecosystem applicability

Some signals only make sense for a given stack: a lockfile, a runtime version pin, a test runner,
a linter, a formatter. The audit detects the repository's ecosystems from their project files and
scores each of these signals on the ecosystem's own equivalent files. All other signals
(agent instructions, safety, architecture docs, documentation, CI, `.editorconfig`, dependency
update bots) are the same for every repository.

### Detection

| Ecosystem | Detected from                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Node.js   | `package.json`, or a root `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb` |
| Python    | `pyproject.toml`, `setup.py`, `Pipfile`, or a root `requirements*.txt` / `requirements/*.txt`         |
| Go        | `go.mod`                                                                                              |
| Rust      | `Cargo.toml`                                                                                          |

Manifests count up to four directory levels deep (so `frontend/package.json` or
`services/api/go.mod` are found), except in dependency, build, virtual environment, fixture, and
example directories (`node_modules`, `vendor`, `third_party`, `dist`, `build`, `out`, `target`,
`bin`, `obj`, `.next`, `coverage`, `.venv`, `venv`, `.tox`, `.nox`, `__pycache__`,
`site-packages`, `fixtures`, `__fixtures__`, `testdata`, `examples`, `example`). A nested
`requirements.txt` (for example `docs/requirements.txt`) does not make a repository Python.

The detected ecosystems are reported in the `ecosystems` field of the JSON output (for example
`["node", "python"]`, or `[]` when none matched) and in the terminal, Markdown, and HTML reports.

### Formula

For an ecosystem-specific signal worth `P` points:

```
detected ecosystems E (|E| ≥ 1):  points = floor(P × satisfied(E) / |E|)
no ecosystem detected:            points = P if any supported ecosystem's evidence exists, else 0
```

- **Polyglot repositories** are scored on every stack. A Python API with a Next.js frontend that
  locks Python dependencies (`uv.lock`) but not Node.js ones gets `floor(3 × 1/2) = 1` lockfile
  point and a failing Node.js lockfile finding. Node.js checks are not switched off.
- **Unknown stacks** (for example a Maven or Gradle project) get points only for evidence the audit
  recognizes. A signal never earns points because it does not apply, so an empty repository still
  scores 0.
- `floor` keeps every score an integer and never rounds up past the evidence. The denominator is at
  least 1, so there is no division by zero.

Category maxima and weights are unchanged, every category still has a fixed `maxScore`, and the
total is still the sum of category scores capped at 100. No category is marked not applicable or
left out of the total, so scores stay on the same 0–100 scale. A repository that has an
ecosystem's equivalent file (a `go.sum`, a pytest config) now earns the points a Node.js repository
earns for its own file.

### Ecosystem-specific signals

| Signal (category, points)            | Node.js                                                                                            | Python                                                                                                                        | Go                                                                                     | Rust                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Lockfile (`dependencies`, 3)         | `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`, `npm-shrinkwrap.json` | `uv.lock`, `poetry.lock`, `Pipfile.lock`, `pdm.lock`, `pylock.toml`, or a `requirements*.txt` where every requirement is `==` | `go.sum`, or every `go.mod` declares no `require` (Go creates no `go.sum` then)        | `Cargo.lock`                                                                              |
| Version pin (`dependencies`, 2)      | `.nvmrc`, `.node-version`, `nodejs` in `.tool-versions`, or `engines` in `package.json`            | `.python-version`, `python` in `.tool-versions`, `requires-python` (pyproject) or `python_version` (Pipfile)                  | `go` or `toolchain` directive in `go.mod`, `.go-version`, `golang` in `.tool-versions` | `rust-toolchain(.toml)`, `rust-version` in `Cargo.toml`, `rust` in `.tool-versions`       |
| Test runner (`testing`, 4)           | vitest, jest, playwright, or cypress config                                                        | `pytest.ini`, `conftest.py`, `[tool.pytest.ini_options]`, `setup.cfg [tool:pytest]`, `tox.ini`, `noxfile.py`                  | built-in `go test`, when `*_test.go` files exist                                       | built-in `cargo test`, when Rust tests exist                                              |
| Linter (`code-style`, 3)             | ESLint config                                                                                      | ruff, flake8, or pylint config, or `ruff check` / `flake8` / `pylint` in a task, hook, or CI                                  | `.golangci.*`, or `golangci-lint` / `go vet` / `staticcheck` in a task, hook, or CI    | `clippy.toml`, `[lints.clippy]` in `Cargo.toml`, or `cargo clippy` in a task, hook, or CI |
| Formatter (`code-style`, 3)          | Prettier config                                                                                    | `[tool.black]`, `[tool.ruff.format]`, ruff `[format]`, or `ruff format` / `black` in a task, hook, or CI                      | `gofmt`, `go fmt`, `gofumpt`, or `goimports` in a task, hook, CI, or golangci config   | `rustfmt.toml`, or `cargo fmt` in a task, hook, or CI                                     |
| `.gitignore` entries (`git-hygiene`) | `node_modules`, `dist`                                                                             | `__pycache__` (or `*.pyc`), `.venv` (or `venv`)                                                                               | binaries (`*.exe`, `*.test`, `bin/`), coverage (`*.out`)                               | `target`, `debug` (or `*.rs.bk`, `*.pdb`)                                                 |

"Task, hook, or CI" means a `Makefile`, `justfile`, `Taskfile`, `.pre-commit-config.yaml`,
`lefthook.yml`, `.github/workflows/*`, `.gitlab-ci.yml`, `tox.ini`, `noxfile.py`, or
`pyproject.toml`.

Without a detected ecosystem the Node.js wording is kept for linter, formatter, and `.gitignore`
findings, and the Node.js `.gitignore` entries are expected, as before.

### Where scoring did not change

- Node.js-only repositories keep the same root-level evidence, points, and messages. The few
  differences, all from evidence the audit used to miss or miscount:
  - ESLint and Prettier configs, lockfiles, and `.nvmrc` / `.node-version` in nested packages
    (up to four levels) count when the root has none.
  - pre-commit, lefthook, and `.githooks/` count as git hooks, like Husky.
  - `.tool-versions` counts as a Node.js pin only when it lists `nodejs`.
  - Test files under `fixtures/`, `vendor/`, `build/`, `coverage/`, and similar directories are
    no longer counted (from the #27 fix).
- Agent instructions, architecture docs, safety, navigability, prompt assets, documentation,
  containerization, and IDE configuration.
- Category IDs, labels, maximum scores, and the 100-point cap.

### Comparing scores across versions

Scores from earlier versions are directly comparable for Node.js-only repositories. Repositories
with Python, Go, or Rust usually score higher than before, because the audit now sees files it used
to ignore. Polyglot repositories with a root `package.json` may score lower, because their other
stacks are now checked too. Score history (`.ark/history.json`) and `ark diff` keep working, but a
change in score across this upgrade can come from the scoring change, not from the repository.

---

## Per-category scoring detail

### Agent instructions (max 20)

| Condition                                     | Score |
| --------------------------------------------- | ----: |
| `AGENTS.md` + at least one tool-specific file |    20 |
| `AGENTS.md` only                              |    15 |
| Tool-specific files only (no `AGENTS.md`)     |    10 |
| None                                          |     0 |

A tool-specific file is any instruction file for a specific agent tool:

- **Cursor:** `.cursorrules`, `.cursor/rules/*.mdc`
- **Copilot:** `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md`
- **Claude Code:** `CLAUDE.md`, `claude.md`, `.claude/CLAUDE.md`, `.claude/claude.md`, `.claude/commands/*.md`, `.claude/agents/**/*.md`, `.claude/skills/**/SKILL.md`, `.claude/rules/**/*.md`
- **Gemini:** `GEMINI.md`, `.gemini/styleguide.md`
- **Amp:** `AGENT.md`
- **Windsurf:** `.windsurfrules`, `.windsurf/rules/**/*.md`
- **Cline:** `.clinerules` (file or directory of `*.md`)
- **Roo Code:** `.roorules`, `.roo/rules*/**/*.md`
- **Kiro:** `.kiro/steering/**/*.md`
- **Junie:** `.junie/guidelines.md`
- **Augment:** `.augment-guidelines`, `.augment/rules/**/*.md`
- **Continue:** `.continue/rules/**/*.md`
- **Goose:** `.goosehints`

`CLAUDE.md` at the repo root is the canonical Claude Code file. The lowercase and
nested variants are recognized because real repos use them. When only a lowercase
`claude.md` is present (and no root `CLAUDE.md`), the audit still counts it but
warns that you should rename it to `CLAUDE.md`. `.claude/commands/*.md` files
count as Claude context but are not treated as a replacement for a root
`CLAUDE.md`.

### Project architecture clarity (max 15)

| Signal                                                                                 | Points |
| -------------------------------------------------------------------------------------- | -----: |
| `README.md` present                                                                    |      5 |
| `docs/ARCHITECTURE.md` or ADR directory                                                |      7 |
| Monorepo `apps/` + `packages/` directories                                             |      3 |
| Workspaces in `package.json`, `go.work`, Cargo `[workspace]`, or `[tool.uv.workspace]` |      2 |

### Developer workflow clarity (max 15)

Commands are read from root `package.json` scripts, a `Makefile`, `justfile`, `Taskfile.yml`,
`pyproject.toml` tasks (poe, pdm, hatch, taskipy), `tox.ini` environments, and `noxfile.py`
sessions. When there is no root `package.json`, nested ones (for example
`frontend/package.json`) are read. `package.json` scripts need the exact name; other task runners
also accept aliases (`fmt` → format, `vet`/`clippy` → lint, `mypy`/`pyright`/`type-check` →
typecheck, `run`/`serve`/`start`/`watch` → dev, `compile` → build) and prefixed names such as
`test-unit`. In a repository that is only Go and/or Rust, a build command also earns the typecheck
points, because the compiler type-checks during the build.

| Command     | Points |
| ----------- | -----: |
| `dev`       |      2 |
| `build`     |      3 |
| `lint`      |      2 |
| `test`      |      3 |
| `typecheck` |      3 |
| `format`    |      1 |
| `clean`     |      1 |

All seven commands present yields **15/15**.

### Testing and validation (max 15)

| Signal                                              | Points |
| --------------------------------------------------- | -----: |
| Test files found (see conventions below)            |      5 |
| Test runner configured (per ecosystem, see above)   |      4 |
| CI workflow in `.github/workflows/`                 |      3 |
| Test command (`package.json` script or task runner) |      2 |
| Coverage config (see below)                         |      1 |

Coverage is detected from `codecov.yml`, c8, vitest or jest coverage, `.coveragerc`,
`[tool.coverage]`, `setup.cfg [coverage:*]`, tarpaulin, or `-coverprofile` / `-cover`,
`cargo tarpaulin` / `cargo llvm-cov`, `--cov`, or `coverage run` in a task, hook, or CI file.

Test files are recognized by these conventions:

| Language              | Pattern                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| JavaScript/TypeScript | `*.test.*`, `*.spec.*` (`js`, `jsx`, `mjs`, `cjs`, `ts`, `tsx`, `mts`, `cts`), `__tests__/`                |
| Go                    | `*_test.go`                                                                                                |
| Python                | `test_*.py`, `*_test.py`                                                                                   |
| Rust                  | `tests/**/*.rs`, and `src/**/*.rs` files containing `#[test]` or `#[cfg(test)]` when a `Cargo.toml` exists |
| Ruby                  | `*_spec.rb`, `test_*.rb`, `*_test.rb`                                                                      |
| Java/Kotlin           | `src/test/**`, `*Test.java`, `*Tests.java` (and `.kt`)                                                     |
| C#                    | `*.Tests/**/*.cs`, `*Test.cs`, `*Tests.cs`                                                                 |
| Any                   | files under a root `tests/` or `test/` directory                                                           |

Files under dependency, build, virtual environment, and fixture directories are not counted:
`node_modules`, `vendor`, `third_party`, `dist`, `build`, `out`, `target`, `bin`, `obj`, `.next`,
`coverage`, `.venv`, `venv`, `.tox`, `.nox`, `__pycache__`, `site-packages`, `fixtures`,
`__fixtures__`, and `testdata`. At most 500 Rust source files are read for inline tests.

A test file proves that tests exist, not that they pass. The other signals in this category cover
whether tests are configured (runner config, test command) and verified (CI).

### Safety boundaries (max 15)

| Signal                                                                  |            Points |
| ----------------------------------------------------------------------- | ----------------: |
| Safety/ops doc (`.env.example`, `SECURITY.md`, `docs/migrations`, etc.) |     3 each, max 9 |
| Docs mention safety keywords (auth, secrets, migration, etc.)           | 2 per file, max 6 |
| `.claude/settings.json` denies reading `.env` files                     |                 2 |
| `.claude/settings.json` sets `bypassPermissions` or allows any `Bash`   |                −5 |

The category never drops below 0. Claude Code settings that auto-approve every
MCP server (`enableAllProjectMcpServers`) get a warning without a deduction.

### Codebase navigability (max 10)

| Signal                                                      | Points |
| ----------------------------------------------------------- | -----: |
| `docs/ROUTES.md`                                            |      2 |
| `docs/API.md`                                               |      2 |
| `docs/SCORING.md`                                           |      2 |
| OpenAPI spec                                                |      2 |
| `docs/SCHEMA.md` or `docs/DATA_MODEL.md`                    | 1 each |
| Feature/module directory (`src/features`, `src/modules`)    |      2 |
| ≥3 CLI module directories (`src/audit`, `src/report`, etc.) |      1 |
| Full CLI module layout (all 5)                              |      1 |

### Prompt assets (max 10)

| Signal                                               | Points |
| ---------------------------------------------------- | -----: |
| `docs/prompts/` directory                            |      2 |
| `prompts/` directory                                 |      2 |
| `.cursor/rules/` directory                           |      2 |
| Prompt/template files found                          |      2 |
| Named task prompts (QA/refactor/bugfix/feature/task) |      3 |
| QA prompt specifically present                       |      1 |

### Dependency hygiene (max 10)

| Signal                                                                                                               | Points |
| -------------------------------------------------------------------------------------------------------------------- | -----: |
| Lockfile (per ecosystem, see above)                                                                                  |      3 |
| Runtime or toolchain version pin (per ecosystem, see above)                                                          |      2 |
| Automated dependency updates (dependabot or renovate)                                                                |      3 |
| Package manager config (`.npmrc`, `.pnpmfile.cjs`, `uv.toml`, `pip.conf`, `[tool.uv]`, `.cargo/config.toml`)         |      1 |
| Workspace (`pnpm-workspace.yaml` with `apps/` or `packages/`, `go.work`, Cargo `[workspace]`, `[tool.uv.workspace]`) |      1 |

Go has no repository-level package manager config file, so a Go-only repository can reach 9 of 10.

### Code style tooling (max 10)

| Signal                                | Points |
| ------------------------------------- | -----: |
| Linter (per ecosystem, see above)     |      3 |
| Formatter (per ecosystem, see above)  |      3 |
| `.editorconfig`                       |      2 |
| `.prettierignore` or `.eslintignore`  | 1 each |
| Biome config (lint + format combined) |      3 |

### Documentation coverage (max 10)

| Signal                                               | Points |
| ---------------------------------------------------- | -----: |
| Rich `README.md` (≥4 quality sections and ≥20 lines) |      4 |
| Partial `README.md` (≥2 sections or ≥15 lines)       |      2 |
| Minimal `README.md` (exists)                         |      1 |
| `CHANGELOG.md` (or `HISTORY.md`)                     |      3 |
| `CONTRIBUTING.md`                                    |      2 |
| `CODE_OF_CONDUCT.md`                                 |      1 |

Quality sections counted: install, usage, getting started, setup, development, contributing, license, overview.

### Git hygiene (max 10)

| Signal                                                                                                   | Points |
| -------------------------------------------------------------------------------------------------------- | -----: |
| Comprehensive `.gitignore` (all but one expected entry, see below)                                       |      3 |
| Partial `.gitignore` (covers ≥1 expected entry)                                                          |      2 |
| Minimal `.gitignore` (present)                                                                           |      1 |
| Commit message linting (commitlint, gitlint, cocogitto, commitizen)                                      |      3 |
| Git hooks: Husky, pre-commit, lefthook, `.githooks/` (when no linting)                                   |      1 |
| `.gitattributes`                                                                                         |      2 |
| Release automation (release-it, semantic-release, changesets, GoReleaser, release-please, cargo-release) |      2 |

Expected `.gitignore` entries are `.env`, `.DS_Store`, and the entries of each detected ecosystem
(see above). A single-ecosystem repository needs 3 of 4, as before.

### Containerization (max 5)

| Signal                               | Points |
| ------------------------------------ | -----: |
| `Dockerfile` present                 |      2 |
| `docker-compose.yml` / `compose.yml` |      2 |
| `.dockerignore`                      |      1 |

### IDE configuration (max 5)

| Signal                    | Points |
| ------------------------- | -----: |
| `.vscode/` directory      |      1 |
| `.vscode/settings.json`   |      1 |
| `.vscode/extensions.json` |      1 |
| `.vscode/launch.json`     |      1 |
| `.vscode/tasks.json`      |      1 |

---

## Placeholder warnings

Starter templates from `ark init` may contain placeholder markers. The audit warns when checked-in `AGENTS.md`, architecture docs, or `docs/prompts/*.md` still look like uncustomized templates. Customize those files for your project to clear warnings.

## Output formats

| Format             | Flag / command    | Module                 |
| ------------------ | ----------------- | ---------------------- |
| Terminal (colored) | default           | `formatTerminalReport` |
| JSON               | `--json`          | `formatAuditJson`      |
| Markdown           | `--output *.md`   | `formatMarkdownReport` |
| HTML               | `--output *.html` | `formatHtmlReport`     |
| JUnit XML          | `--junit`         | `formatJunitReport`    |
| SARIF 2.1.0        | `--sarif`         | `formatSarifReport`    |
| SVG badge          | `ark badge`       | `formatBadgeSvg`       |
| Score diff         | `ark diff`        | `formatDiffReport`     |
