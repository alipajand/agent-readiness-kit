# Feature implementation prompt

## Objective

Implement the described feature within agent-readiness-kit architecture boundaries. Preserve deterministic audits, safe-write generation, and existing CLI command names.

## Scope

**Included:** the modules named in the task (typically `src/audit/`, `src/generate/`, `src/report/`, `src/config/`, or `src/fs/`) plus focused tests and docs.

**Excluded:** telemetry, auth, external APIs, web UI, and broad unrelated refactors.

## Files to inspect

- `src/cli.ts` — command routing for new flags or options
- `docs/ARCHITECTURE.md` — module boundaries
- `docs/API.md` — exported contracts
- `tests/` — add or update specs for new behavior

## Implementation rules

- Follow existing patterns; no unrelated refactors.
- Run `pnpm test` and `pnpm typecheck` before finishing.
- Ask before auth, billing, security, or schema changes.

## Acceptance criteria

- [ ] Behavior matches requirements
- [ ] Tests pass
- [ ] No unrelated file changes

## Commands to run

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## Final report

- Summary, files changed, commands run, test output, risks.
