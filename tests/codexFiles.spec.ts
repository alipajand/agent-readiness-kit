import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateCodex } from '../src/generate/codexFiles.js';

describe('generateCodex', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-codex-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('creates AGENTS.md and a Codex task prompt', async () => {
    const results = await generateCodex({ repoPath });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'created')).toBe(true);

    const agents = await readFile(path.join(repoPath, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('# Agent instructions');
    const prompt = await readFile(
      path.join(repoPath, 'docs', 'prompts', 'CODEX_TASK_PROMPT.md'),
      'utf8',
    );
    expect(prompt).toContain('Codex task prompt');
  });

  it('skips existing files without force', async () => {
    await generateCodex({ repoPath });
    const results = await generateCodex({ repoPath });
    expect(results.every((r) => r.status === 'skipped')).toBe(true);
  });

  it('overwrites existing files with force', async () => {
    await generateCodex({ repoPath });
    const results = await generateCodex({ repoPath, force: true });
    expect(results.every((r) => r.status === 'overwritten')).toBe(true);
  });
});
