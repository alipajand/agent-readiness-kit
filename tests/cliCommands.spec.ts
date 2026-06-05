import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, it, expect, afterEach } from 'vitest';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
const cliPath = path.join(projectRoot, 'src/cli.ts');

type CliResult = { stdout: string; stderr: string };

async function runCli(args: string[]): Promise<CliResult> {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', cliPath, ...args],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  return { stdout, stderr };
}

async function runCliExpectFail(
  args: string[],
): Promise<CliResult & { code: number }> {
  try {
    await execFileAsync(
      process.execPath,
      ['--import', 'tsx', cliPath, ...args],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    throw new Error('expected command to fail');
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      code: e.code ?? 1,
    };
  }
}

describe('ark CLI commands', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = '';
    }
  });

  describe('check', () => {
    it('runs a single category and prints findings', async () => {
      const { stdout } = await runCli([
        'check',
        'agent-instructions',
        projectRoot,
      ]);
      expect(stdout).toContain('Agent instructions:');
      expect(stdout).toMatch(/[✓⚠✗]/);
    });

    it('outputs JSON for a single category with --json', async () => {
      const { stdout } = await runCli([
        'check',
        'workflow',
        '--json',
        projectRoot,
      ]);
      const parsed = JSON.parse(stdout);
      expect(parsed.id).toBe('workflow');
      expect(parsed).toHaveProperty('score');
      expect(parsed).toHaveProperty('findings');
    });

    it('exits with code 1 for an unknown category', async () => {
      const { stderr, code } = await runCliExpectFail([
        'check',
        'not-a-category',
        projectRoot,
      ]);
      expect(code).toBe(1);
      expect(stderr).toContain('Unknown category');
    });
  });

  describe('init', () => {
    it('creates starter files in an empty directory', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-init-'));
      const { stdout } = await runCli(['init', tmpDir]);
      expect(stdout).toContain('Created: AGENTS.md');
      await expect(
        access(path.join(tmpDir, 'AGENTS.md')),
      ).resolves.toBeUndefined();
      await expect(
        access(path.join(tmpDir, 'docs/ARCHITECTURE.md')),
      ).resolves.toBeUndefined();
    });

    it('skips existing files without --force', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-init-'));
      await runCli(['init', tmpDir]);
      const { stdout } = await runCli(['init', tmpDir]);
      expect(stdout).toContain('Skipped (exists)');
    });
  });

  describe('generate', () => {
    it('creates cursor rules via generate cursor', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-gen-'));
      const { stdout } = await runCli(['generate', 'cursor', tmpDir]);
      expect(stdout).toContain('Created:');
      expect(stdout).toContain('project.mdc');
    });

    it('creates copilot instructions via generate copilot', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-gen-'));
      const { stdout } = await runCli(['generate', 'copilot', tmpDir]);
      expect(stdout).toContain('copilot-instructions.md');
    });
  });

  describe('fix', () => {
    it('reports nothing to fix when all checks pass', async () => {
      const { stdout } = await runCli(['fix', projectRoot]);
      expect(stdout).toContain('No failing checks');
    });

    it('scaffolds missing files in an empty repo', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-fix-'));
      const { stdout } = await runCli(['fix', tmpDir]);
      expect(stdout).toContain('failing check');
      expect(stdout).toContain('Created:');
      await expect(
        access(path.join(tmpDir, 'AGENTS.md')),
      ).resolves.toBeUndefined();
    });
  });

  describe('diff', () => {
    it('compares two audit JSON files', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-diff-'));
      const before = {
        repoPath: '/tmp',
        score: 50,
        categories: [
          {
            id: 'agent-instructions',
            label: 'Agent instructions',
            score: 10,
            maxScore: 20,
            findings: [],
          },
        ],
        missing: [],
        recommendations: [],
      };
      const after = { ...before, score: 65 };
      const beforePath = path.join(tmpDir, 'before.json');
      const afterPath = path.join(tmpDir, 'after.json');
      await writeFile(beforePath, JSON.stringify(before));
      await writeFile(afterPath, JSON.stringify(after));

      const { stdout } = await runCli(['diff', beforePath, afterPath]);
      expect(stdout).toContain('Agent Readiness Score Diff');
      expect(stdout).toContain('50');
      expect(stdout).toContain('65');
      expect(stdout).toContain('+15');
    });

    it('exits with code 1 when JSON files are invalid', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-diff-'));
      const badPath = path.join(tmpDir, 'bad.json');
      await writeFile(badPath, '{ invalid');
      const goodPath = path.join(tmpDir, 'good.json');
      await writeFile(
        goodPath,
        JSON.stringify({
          score: 0,
          categories: [],
          missing: [],
          recommendations: [],
          repoPath: '/tmp',
        }),
      );

      const { stderr, code } = await runCliExpectFail([
        'diff',
        badPath,
        goodPath,
      ]);
      expect(code).toBe(1);
      expect(stderr).toContain('Failed to read audit JSON');
    });
  });

  describe('badge', () => {
    it('prints SVG to stdout by default', async () => {
      const { stdout } = await runCli(['badge', projectRoot]);
      expect(stdout.trim().startsWith('<svg')).toBe(true);
      expect(stdout).toContain('/100');
    });

    it('writes SVG to a file with --output', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-badge-'));
      const outPath = path.join(tmpDir, 'badge.svg');
      const { stderr } = await runCli([
        'badge',
        '--output',
        outPath,
        projectRoot,
      ]);
      expect(stderr).toContain('Badge written');
      const svg = await readFile(outPath, 'utf8');
      expect(svg).toContain('<svg');
    });
  });

  describe('audit output formats', () => {
    it('outputs JUnit XML with --junit', async () => {
      const { stdout } = await runCli(['audit', '--junit', projectRoot]);
      expect(stdout).toContain('<?xml version="1.0"');
      expect(stdout).toContain('<testsuites');
    });

    it('outputs SARIF JSON with --sarif', async () => {
      const { stdout } = await runCli(['audit', '--sarif', projectRoot]);
      const sarif = JSON.parse(stdout);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs[0].tool.driver.name).toBe('ark');
    });

    it('writes HTML report when output ends with .html', async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-html-'));
      const outPath = path.join(tmpDir, 'report.html');
      await runCli(['audit', '--output', outPath, projectRoot]);
      const html = await readFile(outPath, 'utf8');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Agent Readiness Report');
    });
  });
});
