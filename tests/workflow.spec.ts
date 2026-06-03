import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkWorkflow } from '../src/audit/checks/workflow.js';

async function writePackageJson(
  dir: string,
  scripts: Record<string, string>,
): Promise<void> {
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ scripts }));
}

describe('checkWorkflow', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-workflow-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 15/15 when all scripts are present', async () => {
    await writePackageJson(repoPath, {
      dev: 'tsx src/cli.ts',
      build: 'tsc',
      lint: 'tsc --noEmit',
      test: 'vitest run',
      typecheck: 'tsc --noEmit',
      format: 'prettier -w .',
      clean: 'rm -rf dist',
    });

    const result = await checkWorkflow(repoPath);
    expect(result.score).toBe(15);
    expect(result.maxScore).toBe(15);
  });

  it('scores less than full when only dev, build, and lint are present', async () => {
    await writePackageJson(repoPath, {
      dev: 'tsx src/cli.ts',
      build: 'tsc',
      lint: 'tsc --noEmit',
    });

    const result = await checkWorkflow(repoPath);
    expect(result.score).toBe(7);
    expect(result.score).toBeLessThan(15);
  });

  it('creates a fail finding when test script is missing', async () => {
    await writePackageJson(repoPath, {
      dev: 'tsx src/cli.ts',
      build: 'tsc',
      lint: 'tsc --noEmit',
      typecheck: 'tsc --noEmit',
    });

    const result = await checkWorkflow(repoPath);
    expect(result.findings.some((f) => f.status === 'fail' && f.message.includes('test'))).toBe(
      true,
    );
  });

  it('creates a warn finding when typecheck script is missing', async () => {
    await writePackageJson(repoPath, {
      dev: 'tsx src/cli.ts',
      build: 'tsc',
      lint: 'tsc --noEmit',
      test: 'vitest run',
    });

    const result = await checkWorkflow(repoPath);
    expect(
      result.findings.some((f) => f.status === 'warn' && f.message.includes('typecheck')),
    ).toBe(true);
  });
});
