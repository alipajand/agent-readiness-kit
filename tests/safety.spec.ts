import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
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

  describe('Claude Code settings', () => {
    const writeSettings = async (settings: unknown) => {
      await mkdir(path.join(repoPath, '.claude'), { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'settings.json'),
        typeof settings === 'string' ? settings : JSON.stringify(settings),
      );
    };

    it('rewards deny rules that cover .env files', async () => {
      await writeSettings({ permissions: { deny: ['Read(./.env)'] } });
      const result = await checkSafety(repoPath);
      expect(result.score).toBe(2);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          status: 'pass',
          message: 'Claude Code settings deny reading .env files',
        }),
      );
    });

    it('warns when settings do not deny .env reads', async () => {
      await writeSettings({ permissions: { allow: ['Bash(pnpm test)'] } });
      const result = await checkSafety(repoPath);
      expect(result.score).toBe(0);
      expect(
        result.findings.some(
          (f) => f.status === 'warn' && f.message.includes('.env'),
        ),
      ).toBe(true);
    });

    it.each([
      [{ permissions: { defaultMode: 'bypassPermissions' } }, 'bypass'],
      [{ permissions: { allow: ['Bash(*)'] } }, 'any shell command'],
    ])('penalizes %j', async (settings, text) => {
      await writeFile(path.join(repoPath, '.env.example'), 'API_KEY=');
      await writeFile(path.join(repoPath, 'SECURITY.md'), '# Security');
      await writeSettings(settings);
      const result = await checkSafety(repoPath);
      expect(result.score).toBe(1);
      expect(
        result.findings.some(
          (f) => f.status === 'fail' && f.message.includes(text),
        ),
      ).toBe(true);
    });

    it('warns on invalid JSON and never goes below 0', async () => {
      await writeSettings('{ nope');
      expect((await checkSafety(repoPath)).score).toBe(0);
      await writeSettings({
        permissions: { defaultMode: 'bypassPermissions' },
      });
      expect((await checkSafety(repoPath)).score).toBe(0);
    });

    it('ignores settings linked from outside the repository', async () => {
      const outside = await mkdtemp(path.join(tmpdir(), 'ark-outside-'));
      try {
        await writeFile(
          path.join(outside, 'settings.json'),
          JSON.stringify({ permissions: { deny: ['Read(./.env)'] } }),
        );
        await mkdir(path.join(repoPath, '.claude'));
        await symlink(
          path.join(outside, 'settings.json'),
          path.join(repoPath, '.claude', 'settings.json'),
        );
        const result = await checkSafety(repoPath);
        expect(result.score).toBe(0);
        expect(
          result.findings.some((f) => f.message.includes('Claude Code')),
        ).toBe(false);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });
  });
});
