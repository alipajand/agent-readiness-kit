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

    await runAudit(['--output', reportPath, projectRoot]);

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
      projectRoot,
    ]);

    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(stdout.trim().startsWith('{')).toBe(true);
    expect(stdout).not.toContain('Report written');
    expect(stderr).toContain('Report written');
    expect(stderr).toContain(reportPath);
  });
});
