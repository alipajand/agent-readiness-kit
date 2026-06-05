import { describe, it, expect } from 'vitest';
import {
  AGENTS_MD,
  ARCHITECTURE_MD,
  QA_AUDIT_PROMPT,
  FEATURE_IMPLEMENTATION_PROMPT,
  REFACTOR_PROMPT,
  CODEX_TASK_PROMPT,
  CLAUDE_TASK_PROMPT,
  CLAUDE_MD,
  COPILOT_INSTRUCTIONS_MD,
  GITHUB_CI_WORKFLOW,
  GITHUB_PR_TEMPLATE,
  GITHUB_DEPENDABOT,
  VSCODE_SETTINGS,
  VSCODE_EXTENSIONS,
  VSCODE_LAUNCH,
  CURSOR_PROJECT_MDC,
  PROMPT_SECTIONS,
} from '../src/generate/templates.js';

describe('markdown templates', () => {
  it('AGENTS.md has the expected top-level heading', () => {
    expect(AGENTS_MD.startsWith('# Agent instructions')).toBe(true);
  });

  it('ARCHITECTURE.md has the expected heading', () => {
    expect(ARCHITECTURE_MD.startsWith('# Architecture')).toBe(true);
  });

  it('CLAUDE.md and Copilot instructions are non-empty', () => {
    expect(CLAUDE_MD.length).toBeGreaterThan(0);
    expect(COPILOT_INSTRUCTIONS_MD).toContain('GitHub Copilot instructions');
  });
});

describe('prompt templates', () => {
  const prompts = {
    QA_AUDIT_PROMPT,
    FEATURE_IMPLEMENTATION_PROMPT,
    REFACTOR_PROMPT,
    CODEX_TASK_PROMPT,
    CLAUDE_TASK_PROMPT,
  };

  it('each prompt includes all standard sections', () => {
    for (const prompt of Object.values(prompts)) {
      for (const heading of Object.values(PROMPT_SECTIONS)) {
        expect(prompt).toContain(heading);
      }
    }
  });

  it('prompts have distinct titles', () => {
    const titles = Object.values(prompts).map((p) => p.split('\n')[0]);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('config templates', () => {
  it('VS Code templates are valid JSON', () => {
    expect(() => JSON.parse(VSCODE_SETTINGS)).not.toThrow();
    expect(() => JSON.parse(VSCODE_EXTENSIONS)).not.toThrow();
    expect(() => JSON.parse(VSCODE_LAUNCH)).not.toThrow();
  });

  it('GitHub workflow and PR templates contain expected anchors', () => {
    expect(GITHUB_CI_WORKFLOW).toContain('name: CI');
    expect(GITHUB_PR_TEMPLATE).toContain('## Summary');
    expect(GITHUB_DEPENDABOT).toContain('package-ecosystem: npm');
  });

  it('cursor project rule is non-empty frontmatter doc', () => {
    expect(CURSOR_PROJECT_MDC.startsWith('---')).toBe(true);
    expect(CURSOR_PROJECT_MDC).toContain('Project agent rules');
  });
});
