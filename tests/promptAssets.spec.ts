import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkPromptAssets } from '../src/audit/checks/promptAssets.js';

describe('checkPromptAssets', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-prompts-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 when no prompt assets exist', async () => {
    const result = await checkPromptAssets(repoPath);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(10);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('scores full points with categorized prompts across dirs', async () => {
    await mkdir(path.join(repoPath, 'docs', 'prompts'), { recursive: true });
    await mkdir(path.join(repoPath, 'prompts'), { recursive: true });
    await mkdir(path.join(repoPath, '.cursor', 'rules'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'docs', 'prompts', 'QA_AUDIT_PROMPT.md'),
      '# QA audit\nReal reusable prompt content.',
    );
    await writeFile(
      path.join(repoPath, 'prompts', 'refactor.md'),
      '# Refactor prompt',
    );
    const result = await checkPromptAssets(repoPath);
    expect(result.score).toBe(10);
    expect(result.findings.some((f) => f.status === 'pass')).toBe(true);
  });

  it('scores partial points for an uncategorized prompt file', async () => {
    await mkdir(path.join(repoPath, 'docs', 'prompts'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'docs', 'prompts', 'general.md'),
      '# General notes',
    );
    const result = await checkPromptAssets(repoPath);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(result.maxScore);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('warns about placeholder content in docs/prompts markdown', async () => {
    await mkdir(path.join(repoPath, 'docs', 'prompts'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'docs', 'prompts', 'task.md'),
      '# Task\n- In scope:\n- Out of scope:',
    );
    const result = await checkPromptAssets(repoPath);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('caps the score at maxScore', async () => {
    await mkdir(path.join(repoPath, 'docs', 'prompts'), { recursive: true });
    await mkdir(path.join(repoPath, 'prompts'), { recursive: true });
    await mkdir(path.join(repoPath, '.cursor', 'rules'), { recursive: true });
    await writeFile(path.join(repoPath, 'docs', 'prompts', 'qa.md'), '# QA');
    await writeFile(path.join(repoPath, 'prompts', 'feature.md'), '# Feature');
    await writeFile(
      path.join(repoPath, '.cursor', 'rules', 'bugfix.mdc'),
      '# Bugfix',
    );
    const result = await checkPromptAssets(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
  });
});
