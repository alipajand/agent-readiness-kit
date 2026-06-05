import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateClaude } from '../src/generate/claudeFiles.js';

describe('generateClaude', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-claude-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('creates CLAUDE.md and a task prompt', async () => {
    const results = await generateClaude({ repoPath });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'created')).toBe(true);

    const claude = await readFile(path.join(repoPath, 'CLAUDE.md'), 'utf8');
    expect(claude).toContain('Claude Code instructions');
    const prompt = await readFile(
      path.join(repoPath, 'docs', 'prompts', 'CLAUDE_TASK_PROMPT.md'),
      'utf8',
    );
    expect(prompt).toContain('Claude task prompt');
  });

  it('skips existing files without force', async () => {
    await generateClaude({ repoPath });
    const results = await generateClaude({ repoPath });
    expect(results.every((r) => r.status === 'skipped')).toBe(true);
  });

  it('overwrites existing files with force', async () => {
    await generateClaude({ repoPath });
    const results = await generateClaude({ repoPath, force: true });
    expect(results.every((r) => r.status === 'overwritten')).toBe(true);
  });
});
