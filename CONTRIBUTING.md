# Contributing

Thank you for improving **agent-readiness-kit**. These guidelines apply to humans and AI coding agents.

## Before you start

Read these first:

- [`AGENTS.md`](AGENTS.md) — project overview, commands, and agent boundaries
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — module layout and responsibilities
- [`docs/SCORING.md`](docs/SCORING.md) — category weights and scoring rules
- [`.cursor/rules/`](.cursor/rules/) — Cursor-specific implementation rules

## Local setup

```bash
pnpm install
pnpm dev audit    # run audit against this repo
```

## Development conventions

- **Deterministic audits.** No network calls, randomness, or side effects in checks.
- **Module boundaries.** Checks live in `src/audit/checks/`; use `src/fs/` helpers, not raw `fs`.
- **Safe writes.** Generated files use `writeFileSafe`; never overwrite existing files unless `--force`.
- **Tests required.** Every check change needs specs covering full score, zero score, and at least one edge case.
- **Minimal diffs.** Avoid unrelated refactors and drive-by cleanup.

## Validation

Run all of these before opening a PR:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev audit
```

## Commit and PR style

- Use lowercase conventional commits: `feat:`, `fix:`, `improve:`, `docs:`, `test:`, `refactor:`, `chore:`
- Summary line ≤ 72 characters; no emoji
- Keep diffs focused; list commands run and test results in the PR description

See [`.cursor/rules/COMMITS.mdc`](.cursor/rules/COMMITS.mdc) for examples.

## Forbidden without maintainer approval

- Breaking CLI command names or public flags
- Telemetry, network calls, or external API integrations
- Changing npm publish config or package name
- Disabling tests or skipping CI
