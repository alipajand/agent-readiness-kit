import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInit } from '../src/generate/initFiles.js';

describe('runInit', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-init-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('creates the full starter file set', async () => {
    const results = await runInit({ repoPath });
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.status === 'created')).toBe(true);

    for (const rel of [
      'AGENTS.md',
      'docs/ARCHITECTURE.md',
      'docs/prompts/QA_AUDIT_PROMPT.md',
      'docs/prompts/FEATURE_IMPLEMENTATION_PROMPT.md',
      'docs/prompts/REFACTOR_PROMPT.md',
    ]) {
      await access(path.join(repoPath, rel), constants.F_OK);
    }
  });

  it('skips existing files without force', async () => {
    await runInit({ repoPath });
    const results = await runInit({ repoPath });
    expect(results.every((r) => r.status === 'skipped')).toBe(true);
  });

  it('overwrites existing files with force', async () => {
    await runInit({ repoPath });
    const results = await runInit({ repoPath, force: true });
    expect(results.every((r) => r.status === 'overwritten')).toBe(true);
  });
});
