---
name: adding-an-audit-check
description: Add or extend a scored audit check in agent-readiness-kit, including scoring, tests, and docs. Use when asked to detect a new readiness signal.
---

# Adding an audit check

1. **Find the category.** Each category is a function in `src/audit/checks/<name>.ts` returning a
   `CategoryResult` with `score`, `maxScore`, and `findings`. Extend an existing category before
   adding a new one; a new category also needs `ALL_CHECK_IDS` and `CHECK_MAP` in
   `src/audit/auditRepo.ts`. See `.cursor/rules/CHECK_AUTHORING.mdc`.
2. **Keep the total at 100.** Changing a category's `maxScore` means rebalancing others and
   updating `docs/SCORING.md`.
3. **Use the safe helpers**: `findFiles` (no symlinked directories) and `readTextFile`.
4. **Test it** in `tests/<name>.spec.ts` with fixture repos in a temp directory: pass, fail, and
   an edge case.
5. **Dogfood it**: `pnpm dev audit . --no-history` here and on another repository.
6. **Document it**: `docs/SCORING.md`, `README.md` if user-visible, and `CHANGELOG.md`.
7. Run `/verify`.
