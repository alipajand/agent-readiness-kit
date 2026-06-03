# Refactor prompt

## Objective

Refactor the named code paths in agent-readiness-kit without changing external CLI behavior or audit scoring unless explicitly requested.

## Scope

**Included:** internal modules (`src/audit/`, `src/report/`, `src/generate/`, `src/config/`, `src/fs/`) and their tests.

**Excluded:** renaming CLI commands, adding network calls, and behavior changes outside the refactor target.

## Files to inspect

- The module named in the task (for example `src/audit/checks/workflow.ts`)
- Corresponding specs under `tests/`
- `docs/ARCHITECTURE.md` — confirm boundaries after the refactor

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
