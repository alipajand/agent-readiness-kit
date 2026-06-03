import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateCursor } from '../src/generate/cursorFiles.js';

describe('generateCursor', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-cursor-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('creates .cursor/rules/project.mdc', async () => {
    const results = await generateCursor({ repoPath });
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('created');

    const mdcPath = path.join(repoPath, '.cursor', 'rules', 'project.mdc');
    await access(mdcPath, constants.F_OK);
    expect(path.relative(repoPath, results[0]!.path)).toBe(
      path.join('.cursor', 'rules', 'project.mdc'),
    );
  });
});
