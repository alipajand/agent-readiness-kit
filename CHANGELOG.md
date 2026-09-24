# Changelog

All notable changes to agent-readiness-kit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ark generate claude` also writes `.claude/settings.json` and a `/verify` command (`.claude/commands/verify.md`). The settings pre-approve nothing, ask before `git push`, and deny reading `.env` files, `curl`/`wget`, `rm -rf`, force pushes, and hard resets. The generated `CLAUDE.md` imports `AGENTS.md` with `@AGENTS.md`.
- Safety scoring reads a committed `.claude/settings.json`. Deny rules covering `.env` add 2 points. `defaultMode: bypassPermissions` or an allow rule for any `Bash` command costs 5 points. `enableAllProjectMcpServers` gets a warning. Settings linked from outside the repository are ignored.
- Agent instructions recognize Claude subagents (`.claude/agents/`), skills (`.claude/skills/*/SKILL.md`), and rules (`.claude/rules/`).
- `ark audit --min-score <n>` (and `audit.minScore` in `.arkrc`) exits with code 1 when the score is below `n`, so `ark` can gate CI on its own.
- Agent instructions now recognize Gemini (`GEMINI.md`, `.gemini/styleguide.md`), Amp (`AGENT.md`), Windsurf, Cline, Roo Code, Kiro, Junie, Augment, Continue, Goose, and Copilot path-specific instructions as tool-specific files.
- Library entry point: `import { auditRepo, formatMarkdownReport } from 'agent-readiness-kit'` (`main`, `types`, and `exports` in `package.json`).

### Security

- File type and size are checked on the opened file rather than the path (reads open non-blocking, so FIFOs cannot hang), so a file cannot be swapped between the check and the read. `.arkrc` uses the same reader.
- Markdown escaping also escapes backslashes, so a backslash in a file name cannot cancel an escaped `|` and split a table cell.
- `audit --output` and `badge --output` paths are now resolved against the audited
  repository root and rejected when they escape it (`../` segments or absolute paths
  elsewhere). Pass `--allow-outside` to opt out. `.arkrc` cannot enable it.
- The containment check also resolves symlinks, so a symlinked directory inside the
  repository cannot redirect a report or badge, and nothing is written through a
  symlink at the target. File names starting with `..` (such as `..notes.md`) are no
  longer rejected.
- `init`, `generate`, and `fix` never write through a symlink (dangling or not, even
  with `--force`) and refuse writes that escape the repository through a symlinked
  directory. Refused writes are reported as `Refused (...)`.
- `ark audit` no longer follows a `.ark-history.json` symlink. Previously, auditing a
  repository whose history file pointed elsewhere overwrote that file with JSON. Malformed
  history no longer crashes the audit.
- `.arkrc` `repoPath` values (audit, init, generate) and `audit.output` must stay inside
  the repository, and `--allow-outside` no longer widens an output path taken from `.arkrc`.
- Symlinked directories are not traversed during audits, and files are read only if they
  are regular files under 1 MiB.
- Terminal output neutralizes control and invisible characters; Markdown reports escape
  HTML and use fence-safe code spans.
- Generated CI workflows (`ark generate github`) now set `permissions: contents: read`,
  disable persisted checkout credentials, and use current action versions; the generated
  Dependabot config also updates GitHub Actions.
- Fixed the `js-yaml` (GHSA-2883-xcg3-v3hh) and `nanoid` advisories with range-scoped
  overrides; moved to pnpm 11.

### Fixed

- `missing` no longer lists `AGENTS.md` when it exists but tool-specific instruction files
  are absent; it recommends adding those instead.
- Dependabot targeted a nonexistent `develop` branch, so version updates never ran.

### Changed

- Install docs point to GitHub (`npm install -g github:alipajand/agent-readiness-kit`).
  The npm package named `agent-readiness-kit` belongs to an unrelated project, and the
  previous `pnpm add -D agent-readiness-kit` instruction would have installed it. A
  `prepare` script builds `dist/` for git installs.
- Node.js 22.12 or later is required (`commander` 15 already needed it).
- CI runs format checks and a Node 22/24 matrix with SHA-pinned actions.

## [0.1.0] - 2026-06-19

### Added

- `ark audit` — deterministic repository audit with terminal, JSON, Markdown, HTML, JUnit, and SARIF output
- `ark init`, `ark generate`, and `ark fix` — safe-write scaffolding for agent instruction files
- Thirteen audit categories covering agent docs, architecture, workflow, testing, safety, navigability, and tooling
- Score history via `.ark-history.json`
- Starter prompt templates under `docs/prompts/`
- Cursor rules under `.cursor/rules/`
