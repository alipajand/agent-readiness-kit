# Migrations

This document tracks breaking changes to the `.arkrc` configuration format and the public CLI surface between versions. Follow these steps when upgrading `ark` in a project.

## v0.x → future v1.0

No breaking changes have been released yet. This section will be populated when a v1.0 release is planned.

## `.arkrc` format

The `.arkrc` file is optional. When present it is validated with Zod at runtime. The current accepted shape is:

```json
{
  "repoPath": "./",
  "checks": [
    "agent-instructions",
    "architecture",
    "workflow",
    "testing",
    "safety",
    "navigability",
    "prompt-assets",
    "dependencies",
    "code-style",
    "documentation",
    "git-hygiene",
    "containerization",
    "ide-config"
  ]
}
```

All fields are optional. Unrecognised keys are ignored (not an error) so that config written for a future version of ark will still run with the current version.

## Adding a new check

1. Create `src/audit/checks/<name>.ts` implementing `CategoryResult`.
2. Register it in the `CHECK_MAP` in `src/audit/auditRepo.ts` and add the ID to `ALL_CHECK_IDS`.
3. Write a test in `tests/<name>.spec.ts` covering: full-score case, zero-score case, and at least one partial/edge case.
4. Update `docs/SCORING.md` with the new category and point breakdown.
5. Update `docs/API.md` to list the new check function.

## Renaming or removing a check

Renaming a check ID is a breaking change for consumers who pin `checks` in `.arkrc`. Bump the minor version and document the rename here.

## Score history format

`.ark-history.json` stores up to 20 entries per repository:

```json
{
  "entries": [
    {
      "timestamp": "2026-06-04T17:00:00.000Z",
      "score": 85,
      "categories": [
        { "id": "agent-instructions", "label": "Agent instructions", "score": 20, "maxScore": 20 }
      ]
    }
  ]
}
```

This file is written by `ark audit` and read to compute the `▲/▼` delta shown in terminal output. Add it to `.gitignore` if you do not want history committed, or commit it to track progress over time.

## Production safety

- `ark` has no network calls, no telemetry, and no authentication. It is entirely local.
- The `writeFileSafe` helper never overwrites existing files unless `--force` is passed — safe to run in CI.
- No secrets are read or written by any check.
- `.ark-history.json` contains only scores and timestamps — no file contents or secrets.
