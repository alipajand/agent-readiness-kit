import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkArchitecture } from '../src/audit/checks/architecture.js';

describe('checkArchitecture', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-arch-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 in an empty repo', async () => {
    const result = await checkArchitecture(repoPath);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(15);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('scores full points with README, architecture doc, and workspaces', async () => {
    await writeFile(path.join(repoPath, 'README.md'), '# Project');
    await mkdir(path.join(repoPath, 'docs'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'docs', 'ARCHITECTURE.md'),
      '# Architecture\nReal content describing components.',
    );
    await mkdir(path.join(repoPath, 'apps'), { recursive: true });
    await mkdir(path.join(repoPath, 'packages'), { recursive: true });
    const result = await checkArchitecture(repoPath);
    expect(result.score).toBe(15);
    expect(result.findings.some((f) => f.status === 'pass')).toBe(true);
  });

  it('awards partial points for README only', async () => {
    await writeFile(path.join(repoPath, 'README.md'), '# Project');
    const result = await checkArchitecture(repoPath);
    expect(result.score).toBe(5);
    expect(result.score).toBeLessThan(result.maxScore);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('detects ADR directory as an architecture signal', async () => {
    await writeFile(path.join(repoPath, 'README.md'), '# Project');
    await mkdir(path.join(repoPath, 'docs', 'adr'), { recursive: true });
    const result = await checkArchitecture(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(12);
  });

  it('credits package.json workspaces when no apps/packages dirs', async () => {
    await writeFile(path.join(repoPath, 'README.md'), '# Project');
    await mkdir(path.join(repoPath, 'docs'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'docs', 'ARCHITECTURE.md'),
      '# Architecture\nReal content.',
    );
    await writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({ workspaces: ['packages/*'] }),
    );
    const result = await checkArchitecture(repoPath);
    expect(result.score).toBe(14);
  });

  it('warns about placeholder content in architecture doc', async () => {
    await writeFile(path.join(repoPath, 'README.md'), '# Project');
    await mkdir(path.join(repoPath, 'docs'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'docs', 'ARCHITECTURE.md'),
      '# Architecture\n<!-- List apps, packages, services -->',
    );
    const result = await checkArchitecture(repoPath);
    expect(
      result.findings.some(
        (f) => f.status === 'warn' && f.files?.includes('docs/ARCHITECTURE.md'),
      ),
    ).toBe(true);
  });

  it('caps the score at maxScore', async () => {
    await writeFile(path.join(repoPath, 'README.md'), '# Project');
    await mkdir(path.join(repoPath, 'docs', 'adr'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'docs', 'ARCHITECTURE.md'),
      '# Architecture\nReal content.',
    );
    await mkdir(path.join(repoPath, 'apps'), { recursive: true });
    await mkdir(path.join(repoPath, 'packages'), { recursive: true });
    const result = await checkArchitecture(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
  });
});
