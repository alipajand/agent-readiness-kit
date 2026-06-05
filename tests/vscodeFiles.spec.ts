import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateVscode } from '../src/generate/vscodeFiles.js';

describe('generateVscode', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-vscode-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('creates settings, extensions, and launch files with valid JSON', async () => {
    const results = await generateVscode({ repoPath });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'created')).toBe(true);

    for (const name of ['settings.json', 'extensions.json', 'launch.json']) {
      const raw = await readFile(path.join(repoPath, '.vscode', name), 'utf8');
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  });

  it('skips existing files without force', async () => {
    await generateVscode({ repoPath });
    const results = await generateVscode({ repoPath });
    expect(results.every((r) => r.status === 'skipped')).toBe(true);
  });

  it('overwrites existing files with force', async () => {
    await generateVscode({ repoPath });
    const results = await generateVscode({ repoPath, force: true });
    expect(results.every((r) => r.status === 'overwritten')).toBe(true);
  });
});
