import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateCopilot } from '../src/generate/copilotFiles.js';

describe('generateCopilot', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-copilot-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('creates .github/copilot-instructions.md', async () => {
    const results = await generateCopilot({ repoPath });
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('created');

    const rel = path.relative(repoPath, results[0]!.path);
    expect(rel).toBe(path.join('.github', 'copilot-instructions.md'));
    const content = await readFile(results[0]!.path, 'utf8');
    expect(content).toContain('GitHub Copilot instructions');
  });

  it('skips an existing file without force', async () => {
    await generateCopilot({ repoPath });
    const results = await generateCopilot({ repoPath });
    expect(results[0]?.status).toBe('skipped');
  });

  it('overwrites an existing file with force', async () => {
    await generateCopilot({ repoPath });
    const results = await generateCopilot({ repoPath, force: true });
    expect(results[0]?.status).toBe('overwritten');
  });
});
