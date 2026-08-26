import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, it, expect, afterEach } from 'vitest';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
const cliPath = path.join(projectRoot, 'src/cli.ts');

async function runAudit(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', cliPath, 'audit', ...args],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  return { stdout, stderr };
}

async function runAuditExpectFail(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    await runAudit(args);
    throw new Error('expected command to fail');
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', code: e.code ?? 1 };
  }
}

describe('ark audit CLI output', () => {
  let outDir: string;

  afterEach(async () => {
    if (outDir) {
      await rm(outDir, { recursive: true, force: true });
      outDir = '';
    }
  });

  it('writes JSON only to stdout with --json', async () => {
    const { stdout, stderr } = await runAudit(['--json', projectRoot]);

    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(stdout.trim().startsWith('{')).toBe(true);
    expect(stdout).not.toContain('Report written');
    expect(stderr).not.toContain('Report written');
  });

  it('creates the Markdown report file with --output', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-audit-'));
    const reportPath = path.join(outDir, 'report.md');

    await runAudit(['--output', reportPath, '--allow-outside', projectRoot]);

    await expect(access(reportPath)).resolves.toBeUndefined();
    const content = await readFile(reportPath, 'utf8');
    expect(content).toContain('# Agent Readiness Report');
  });

  it('writes JSON only to stdout when --json and --output are both set', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-audit-'));
    const reportPath = path.join(outDir, 'report.md');

    const { stdout, stderr } = await runAudit([
      '--json',
      '--output',
      reportPath,
      '--allow-outside',
      projectRoot,
    ]);

    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(stdout.trim().startsWith('{')).toBe(true);
    expect(stdout).not.toContain('Report written');
    expect(stderr).toContain('Report written');
    expect(stderr).toContain(reportPath);
  });

  it('rejects an --output path that escapes the audited repo', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-audit-'));
    const escaping = path.join(
      path.relative(projectRoot, outDir),
      'escaped.md',
    );

    const { stderr, code } = await runAuditExpectFail([
      '--output',
      escaping,
      projectRoot,
    ]);

    expect(code).toBe(1);
    expect(stderr).toContain('inside the audited repository');
    expect(stderr).toContain('--allow-outside');
    await expect(access(path.join(outDir, 'escaped.md'))).rejects.toThrow();
  });

  it('rejects an absolute --output path outside the audited repo', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'ark-cli-audit-'));
    const reportPath = path.join(outDir, 'report.md');

    const { stderr, code } = await runAuditExpectFail([
      '--output',
      reportPath,
      projectRoot,
    ]);

    expect(code).toBe(1);
    expect(stderr).toContain('inside the audited repository');
    await expect(access(reportPath)).rejects.toThrow();
  });
});
