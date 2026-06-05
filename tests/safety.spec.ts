import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkSafety } from '../src/audit/checks/safety.js';

describe('checkSafety', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-safety-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 when no safety signals exist', async () => {
    const result = await checkSafety(repoPath);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(15);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('scores full points with safety files and keyword-rich docs', async () => {
    await writeFile(path.join(repoPath, '.env.example'), 'API_KEY=');
    await writeFile(path.join(repoPath, 'SECURITY.md'), '# Security policy');
    await mkdir(path.join(repoPath, 'docs', 'security'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'README.md'),
      'Handle secrets and authorization carefully.',
    );
    await writeFile(
      path.join(repoPath, 'AGENTS.md'),
      'Never commit .env or production credentials.',
    );
    await writeFile(
      path.join(repoPath, 'CONTRIBUTING.md'),
      'Run migration and rollback steps in production safely.',
    );
    const result = await checkSafety(repoPath);
    expect(result.score).toBe(15);
    expect(result.findings.some((f) => f.status === 'pass')).toBe(true);
  });

  it('scores partial points for .env.example only', async () => {
    await writeFile(path.join(repoPath, '.env.example'), 'API_KEY=');
    const result = await checkSafety(repoPath);
    expect(result.score).toBe(3);
    expect(result.score).toBeLessThan(result.maxScore);
    expect(
      result.findings.some(
        (f) => f.status === 'pass' && f.files?.includes('.env.example'),
      ),
    ).toBe(true);
  });

  it('warns when safety documentation is limited', async () => {
    await writeFile(path.join(repoPath, '.env.example'), 'API_KEY=');
    const result = await checkSafety(repoPath);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('fails when .env.example is missing', async () => {
    await writeFile(path.join(repoPath, 'SECURITY.md'), '# Security');
    const result = await checkSafety(repoPath);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('caps the score at maxScore', async () => {
    await writeFile(path.join(repoPath, '.env.example'), 'API_KEY=');
    await writeFile(path.join(repoPath, 'SECURITY.md'), '# Security');
    await mkdir(path.join(repoPath, 'docs', 'security'), { recursive: true });
    await mkdir(path.join(repoPath, 'docs', 'operations'), { recursive: true });
    await mkdir(path.join(repoPath, 'docs', 'runbooks'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'README.md'),
      'security secrets auth production migration rollback',
    );
    const result = await checkSafety(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
  });
});
