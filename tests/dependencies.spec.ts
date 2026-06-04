import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkDependencies } from '../src/audit/checks/dependencies.js';

describe('checkDependencies', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-deps-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 when no dependency signals exist', async () => {
    const result = await checkDependencies(repoPath);
    expect(result.score).toBe(0);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('awards points for pnpm-lock.yaml', async () => {
    await writeFile(path.join(repoPath, 'pnpm-lock.yaml'), 'lockfileVersion: 6\n');
    const result = await checkDependencies(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.findings.some((f) => f.message.includes('pnpm-lock.yaml'))).toBe(true);
  });

  it('awards points for .nvmrc', async () => {
    await writeFile(path.join(repoPath, 'pnpm-lock.yaml'), 'lockfileVersion: 6\n');
    await writeFile(path.join(repoPath, '.nvmrc'), '20\n');
    const result = await checkDependencies(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.findings.some((f) => f.message.includes('.nvmrc'))).toBe(true);
  });

  it('awards points for dependabot.yml', async () => {
    await writeFile(path.join(repoPath, 'pnpm-lock.yaml'), '');
    await mkdir(path.join(repoPath, '.github'), { recursive: true });
    await writeFile(path.join(repoPath, '.github', 'dependabot.yml'), 'version: 2\n');
    const result = await checkDependencies(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(6);
    expect(
      result.findings.some((f) => f.message.includes('Dependabot')),
    ).toBe(true);
  });

  it('awards points for engines field in package.json', async () => {
    await writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({ engines: { node: '>=20' } }),
    );
    const result = await checkDependencies(repoPath);
    expect(result.findings.some((f) => f.message.includes('engines'))).toBe(true);
  });

  it('caps score at maxScore', async () => {
    await writeFile(path.join(repoPath, 'pnpm-lock.yaml'), '');
    await writeFile(path.join(repoPath, '.nvmrc'), '20\n');
    await mkdir(path.join(repoPath, '.github'), { recursive: true });
    await writeFile(path.join(repoPath, '.github', 'dependabot.yml'), 'version: 2\n');
    await writeFile(path.join(repoPath, '.npmrc'), 'registry=https://registry.npmjs.org\n');
    const result = await checkDependencies(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
    expect(result.maxScore).toBe(10);
  });
});
