# Migrations

This document tracks breaking changes to the `.arkrc` configuration format and the public CLI surface between versions. Follow these steps when upgrading `ark` in a project.

## v0.x → future v1.0

No breaking changes have been released yet. This section will be populated when a v1.0 release is planned.

## `.arkrc` format

The `.arkrc` file is optional. When present it is validated with Zod at runtime. The current accepted shape is:

```json
{
  "repoPath": "./",
  "checks": ["agent-instructions", "architecture", "workflow", "testing", "safety", "navigability", "prompt-assets"]
}
```

All fields are optional. Unrecognised keys are ignored (not an error) so that config written for a future version of ark will still run with the current version.

## Adding a new check

1. Create `src/audit/checks/<name>.ts` implementing `CategoryResult`.
2. Register it in `src/audit/auditRepo.ts`.
3. Add it to the `checks` default list in `src/config/schema.ts`.
4. Write a test in `tests/<name>.spec.ts`.
5. Update `docs/SCORING.md` with the new category and point breakdown.

## Renaming or removing a check

Renaming a check ID is a breaking change for consumers who pin `checks` in `.arkrc`. Bump the minor version and document the rename here.

## Production safety

- `ark` has no network calls, no telemetry, and no authentication. It is entirely local.
- The `writeFileSafe` helper never overwrites existing files unless `--force` is passed — safe to run in CI.
- No secrets are read or written by any check.
