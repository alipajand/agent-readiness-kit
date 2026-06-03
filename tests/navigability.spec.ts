import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkNavigability } from '../src/audit/checks/navigability.js';

describe('checkNavigability', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-nav-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 when no navigability signals exist', async () => {
    const result = await checkNavigability(repoPath);
    expect(result.score).toBe(0);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('scores above 0 with ROUTES, API, SCORING docs and src modules', async () => {
    await mkdir(path.join(repoPath, 'docs'), { recursive: true });
    await writeFile(path.join(repoPath, 'docs/ROUTES.md'), '# Routes\n');
    await writeFile(path.join(repoPath, 'docs/API.md'), '# API\n');
    await writeFile(path.join(repoPath, 'docs/SCORING.md'), '# Scoring\n');

    for (const dir of [
      'src/audit',
      'src/generate',
      'src/report',
      'src/config',
      'src/fs',
    ]) {
      await mkdir(path.join(repoPath, dir), { recursive: true });
    }

    const result = await checkNavigability(repoPath);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(
      result.findings.some((f) => f.message.includes('docs/ROUTES.md')),
    ).toBe(true);
    expect(
      result.findings.some((f) => f.message.includes('CLI/module directories')),
    ).toBe(true);
  });

  it('adds points for secondary SCHEMA and DATA_MODEL docs', async () => {
    await mkdir(path.join(repoPath, 'docs'), { recursive: true });
    await writeFile(path.join(repoPath, 'docs/SCHEMA.md'), '# Schema\n');
    await writeFile(
      path.join(repoPath, 'docs/DATA_MODEL.md'),
      '# Data model\n',
    );

    const result = await checkNavigability(repoPath);
    expect(result.score).toBe(2);
  });

  it('caps score at 10', async () => {
    await mkdir(path.join(repoPath, 'docs'), { recursive: true });
    await writeFile(path.join(repoPath, 'docs/ROUTES.md'), '# Routes\n');
    await writeFile(path.join(repoPath, 'docs/API.md'), '# API\n');
    await writeFile(path.join(repoPath, 'docs/SCORING.md'), '# Scoring\n');
    await writeFile(path.join(repoPath, 'docs/SCHEMA.md'), '# Schema\n');
    await writeFile(
      path.join(repoPath, 'docs/DATA_MODEL.md'),
      '# Data model\n',
    );
    await writeFile(
      path.join(repoPath, 'docs/openapi.yaml'),
      'openapi: 3.0.0\n',
    );

    for (const dir of [
      'src/audit',
      'src/generate',
      'src/report',
      'src/config',
      'src/fs',
    ]) {
      await mkdir(path.join(repoPath, dir), { recursive: true });
    }
    await mkdir(path.join(repoPath, 'src/features'), { recursive: true });

    const result = await checkNavigability(repoPath);
    expect(result.score).toBe(10);
    expect(result.maxScore).toBe(10);
  });
});
