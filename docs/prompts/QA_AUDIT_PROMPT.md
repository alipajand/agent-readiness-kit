# QA audit prompt

## Objective

Audit the specified change in agent-readiness-kit for regressions, edge cases, and missing tests. Confirm audit checks remain deterministic and that scoring behavior matches `docs/SCORING.md`.

## Scope

**Included:** changes under `src/audit/`, `src/report/`, `src/generate/`, `src/config/`, `src/fs/`, matching `tests/`, and related docs.

**Excluded:** new CLI commands, telemetry, auth, external APIs, and unrelated refactors.

## Files to inspect

- `src/audit/checks/` — category logic under review
- `src/audit/scoring.ts` — score aggregation
- `tests/` — specs covering the changed behavior
- `docs/SCORING.md` — expected scoring weights

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
pnpm dev audit
```

## Final report

- Summary, files changed, commands run, test output, risks.
