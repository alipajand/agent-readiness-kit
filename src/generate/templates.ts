export const AGENTS_MD = `# Agent instructions

This file tells AI coding agents how to work safely in this repo.

## Project overview

<!-- One or two sentences: what this project does, who uses it, and the main stack. -->

## Architecture boundaries

Keep changes focused. Do not make unrelated refactors. Match the patterns,
naming, and types already in the code you are editing.

<!-- List any directories or modules agents should not touch without approval, and link docs/ARCHITECTURE.md when it exists. -->

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

## Validation

Before finishing, run the smallest relevant validation command (usually the
tests for the area you changed). For risky changes, also run the broader
project checks. Add or update tests when you change behavior, and don't disable
tests or skip CI to make a change pass.

## Ask before changing

Ask before touching auth, billing, security, production config, database
migrations, or public API behavior. These are easy to break and hard to undo.

## Final report

When you finish, report:

1. What changed and why
2. Files created or modified
3. Commands run (install, test, lint, build)
4. Test results
5. Anything you left unfinished or are unsure about
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

- In scope: <!-- what this task should change -->
- Out of scope: <!-- what to leave alone -->

${PROMPT_SECTIONS.files}

List the paths worth reading before editing, so changes match what is already there.

${PROMPT_SECTIONS.rules}

- Follow existing patterns. Keep the change focused — no unrelated refactors.
- Run the smallest relevant validation command before finishing.
- Ask before changing auth, billing, security, migrations, or public API behavior.

${PROMPT_SECTIONS.acceptance}

- [ ] Behavior matches the requirements above
- [ ] Tests pass
- [ ] No unrelated file changes

${PROMPT_SECTIONS.commands}

\`\`\`bash
pnpm install
pnpm test
pnpm typecheck
\`\`\`

${PROMPT_SECTIONS.report}

When you finish: a short summary, the files you changed, the commands you ran,
the test output, and anything left unfinished.
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

This file tells Claude Code how to work safely in this repo. \`AGENTS.md\` is the
shared source of truth — read it (and \`docs/ARCHITECTURE.md\` when it exists)
before making large changes.

Keep changes focused. Do not make unrelated refactors. Match the existing
naming, types, and patterns.

Ask before changing auth, billing, security, production config, migrations, or
public API behavior.

Before finishing, run the smallest relevant validation command. For risky
changes, also run the broader project checks.

## Final report

When you finish, share a short summary, the files you changed, the commands you
ran, the test results, and anything you left unfinished.
`;

export const COPILOT_INSTRUCTIONS_MD = `# GitHub Copilot instructions

This file tells GitHub Copilot how to work safely in this repo. Read
\`AGENTS.md\` and \`docs/ARCHITECTURE.md\` before making large changes.

Keep changes focused and avoid unrelated refactors. Match the existing naming,
types, and patterns in the code you touch.

Ask before changing auth, billing, security, production config, migrations, or
public API and CLI behavior.

Before finishing, run the smallest relevant validation command. For risky
changes, also run the broader project checks.

## Final report

When you finish, include a short summary, the files you changed, the commands
you ran, the test results, and anything left unfinished.
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

What changed, and why.

<!-- A couple of sentences is plenty. Link context if it helps a reviewer. -->

## Test plan

- [ ] Tests pass (\`pnpm test\`)
- [ ] Typecheck passes (\`pnpm typecheck\`)
- [ ] Lint passes (\`pnpm lint\`)
- [ ] No unrelated file changes
- [ ] Checked for auth/billing/security impact

## Related issues

<!-- Link issues this closes, e.g. Closes #123. -->
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

What happened, and what you expected instead.

## Steps to reproduce

1.
2.
3.

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

The problem this would solve, from a user's point of view.

## Proposed solution

How you think it should work.

## Alternatives considered

Other approaches you weighed, if any.
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
description: How AI agents should work safely in this repo
globs:
alwaysApply: true
---

# Project agent rules

These rules tell Cursor how to work safely in this repo. \`AGENTS.md\` is the
shared source of truth — read it and \`docs/ARCHITECTURE.md\` before large
changes.

## Working style

- Keep changes focused. Avoid unrelated refactors and drive-by cleanup.
- Match the existing naming, types, and patterns in the code you touch.

## Validation

- Before finishing, run the smallest relevant validation command.
- For risky changes, also run the broader tests, lint, and typecheck.
- Report the commands you ran and their results.

## Ask before changing

- Auth, billing, security, production config, migrations, or public API behavior.
- Never commit secrets or disable safety checks to make a change pass.

## Final report

When you finish, include a short summary, the files you changed, the commands
you ran, the test results, and anything left unfinished.
`;
