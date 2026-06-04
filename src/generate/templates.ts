export const AGENTS_MD = `# Agent instructions

## Project overview

<!-- Describe what this project does, who uses it, and the primary runtime/stack. -->

## Architecture boundaries

<!-- List modules, services, and directories agents must not cross without approval. -->
<!-- Link to docs/ARCHITECTURE.md when available. -->

## Commands

\`\`\`bash
# Development
pnpm dev

# Build
pnpm build

# Lint / typecheck
pnpm lint
pnpm typecheck

# Tests
pnpm test
\`\`\`

## Testing expectations

- Run \`pnpm test\` (or the project test script) before finishing a task.
- Add or update tests when changing behavior.
- Do not disable tests or skip CI checks without explicit approval.

## Forbidden changes without approval

- Authentication, authorization, or session handling
- Billing, payments, or subscription logic
- Security policies, secrets handling, or credential storage
- Database schema migrations in production paths
- Breaking public API contracts

## Final report format

When completing a task, report:

1. Summary of changes
2. Files created or modified
3. Commands run (install, test, lint, build)
4. Test results
5. Known limitations or follow-ups
`;

export const ARCHITECTURE_MD = `# Architecture

## System context

<!-- What problem this system solves and external dependencies. -->

## Major components

<!-- List apps, packages, services, and how they interact. -->

## Boundaries

- **In scope for agents:** <!-- e.g. src/features, API handlers -->
- **Out of scope without review:** <!-- auth, billing, infra -->

## Data flow

<!-- Request/path through layers: API → service → store. -->

## ADRs

<!-- Link docs/adr or docs/decisions for significant choices. -->
`;

export const PROMPT_SECTIONS = {
  objective: '## Objective',
  scope: '## Scope',
  files: '## Files to inspect',
  rules: '## Implementation rules',
  acceptance: '## Acceptance criteria',
  commands: '## Commands to run',
  report: '## Final report',
};

function buildPromptTemplate(title: string, objective: string): string {
  return `# ${title}

${PROMPT_SECTIONS.objective}

${objective}

${PROMPT_SECTIONS.scope}

- In scope:
- Out of scope:

${PROMPT_SECTIONS.files}

- List paths to read before editing.

${PROMPT_SECTIONS.rules}

- Follow existing patterns; no unrelated refactors.
- Run tests and typecheck before finishing.
- Ask before auth, billing, security, or schema changes.

${PROMPT_SECTIONS.acceptance}

- [ ] Behavior matches requirements
- [ ] Tests pass
- [ ] No unrelated file changes

${PROMPT_SECTIONS.commands}

\`\`\`bash
pnpm install
pnpm test
pnpm typecheck
\`\`\`

${PROMPT_SECTIONS.report}

- Summary, files changed, commands run, test output, risks.
`;
}

export const QA_AUDIT_PROMPT = buildPromptTemplate(
  'QA audit prompt',
  'Audit the specified change for regressions, edge cases, and missing tests.',
);

export const FEATURE_IMPLEMENTATION_PROMPT = buildPromptTemplate(
  'Feature implementation prompt',
  'Implement the described feature within existing architecture boundaries.',
);

export const REFACTOR_PROMPT = buildPromptTemplate(
  'Refactor prompt',
  'Refactor the named code paths without changing external behavior.',
);

export const CODEX_TASK_PROMPT = buildPromptTemplate(
  'Codex task prompt',
  'Complete the assigned implementation task using repository conventions.',
);

export const CLAUDE_TASK_PROMPT = buildPromptTemplate(
  'Claude task prompt',
  'Complete the assigned implementation task using repository conventions.',
);

export const CLAUDE_MD = `# Claude Code instructions

Act as an **implementation agent**, not a product strategist.

- Respect \`AGENTS.md\` and \`docs/ARCHITECTURE.md\`.
- Run tests and typecheck before reporting done.
- Avoid unrelated refactors.
- Ask before changes to auth, billing, security, or database schema.

## Final report

Include: summary, files changed, commands run, test results, limitations.
`;

export const COPILOT_INSTRUCTIONS_MD = `# GitHub Copilot instructions

Act as an **implementation agent**, not a product strategist.

- Read \`AGENTS.md\` and \`docs/ARCHITECTURE.md\` before making large changes.
- Prefer minimal, focused diffs. Avoid unrelated refactors.
- Match existing naming conventions, types, and patterns.
- Run tests and typecheck before reporting done.

## Boundaries

Ask before making changes to:
- Authentication, authorization, or session handling
- Billing, payments, or subscription logic
- Security policies, secrets handling, or credential storage
- Database schema migrations in production paths
- Breaking public API contracts or CLI commands

## Final report

When completing a task, include:

1. Summary of changes
2. Files created or modified
3. Commands run (install, test, lint, build)
4. Test results
5. Known limitations or follow-ups
`;

export const GITHUB_CI_WORKFLOW = `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
`;

export const GITHUB_PR_TEMPLATE = `## Summary

<!-- Describe what changed and why. -->

## Test plan

- [ ] Tests pass (\`pnpm test\`)
- [ ] Typecheck passes (\`pnpm typecheck\`)
- [ ] Lint passes (\`pnpm lint\`)
- [ ] No unrelated file changes
- [ ] Reviewed for auth/billing/security impact

## Related issues

<!-- Link issues: Closes #123 -->
`;

export const GITHUB_DEPENDABOT = `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
`;

export const GITHUB_ISSUE_BUG_TEMPLATE = `---
name: Bug report
about: Report a reproducible bug
labels: bug
---

## Description

<!-- What happened? -->

## Steps to reproduce

1.
2.
3.

## Expected behavior

<!-- What should have happened? -->

## Environment

- OS:
- Node.js version:
- Package version:
`;

export const GITHUB_ISSUE_FEATURE_TEMPLATE = `---
name: Feature request
about: Propose a new feature or improvement
labels: enhancement
---

## Problem

<!-- What problem does this feature solve? -->

## Proposed solution

<!-- How should it work? -->

## Alternatives considered

<!-- What other approaches did you consider? -->
`;

export const VSCODE_SETTINGS = `{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.eol": "\\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true
}
`;

export const VSCODE_EXTENSIONS = `{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "EditorConfig.EditorConfig",
    "GitHub.copilot",
    "GitHub.copilot-chat"
  ]
}
`;

export const VSCODE_LAUNCH = `{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug current file",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "tsx",
      "program": "\${file}",
      "cwd": "\${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Run tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "\${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run"],
      "cwd": "\${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}
`;

export const CURSOR_PROJECT_MDC = `---
description: Project implementation rules for AI agents
globs:
alwaysApply: true
---

# Project agent rules

## Role

- Act as an **implementation agent**, not a product strategist.
- Do not make product strategy or scope decisions without human approval.

## Architecture

- Respect existing architecture and module boundaries.
- Read AGENTS.md and docs/ARCHITECTURE.md before large changes.

## Implementation

- Prefer minimal, focused diffs.
- Avoid unrelated refactors and drive-by cleanup.
- Match existing naming, types, and patterns.

## Validation

- Run relevant tests, lint, and typecheck commands before finishing.
- Report commands run and their results.

## Boundaries

- Ask before changes to authentication, authorization, billing, or security.
- Ask before database schema migrations or production configuration.
- Do not commit secrets or disable safety checks.

## Final report

When done, include:

1. Summary of what changed
2. Files created or modified
3. Commands run
4. Test/lint results
5. Known limitations
`;
