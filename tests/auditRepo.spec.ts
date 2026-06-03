import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditRepo } from '../src/audit/auditRepo.js';

describe('auditRepo', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-audit-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('detects missing AGENTS.md', async () => {
    await writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({ scripts: { test: 'vitest run' } }),
    );
    await writeFile(path.join(repoPath, 'README.md'), '# Test\n');

    const result = await auditRepo(repoPath);
    const agent = result.categories.find((c) => c.id === 'agent-instructions');
    expect(agent?.score).toBe(0);
    expect(result.missing).toContain('AGENTS.md');
  });

  it('detects package scripts', async () => {
    await writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({
        scripts: {
          dev: 'tsx src/cli.ts',
          build: 'tsc',
          lint: 'tsc --noEmit',
          test: 'vitest run',
          typecheck: 'tsc --noEmit',
        },
      }),
    );
    await writeFile(path.join(repoPath, 'README.md'), '# Test\n');
    await mkdir(path.join(repoPath, 'tests'), { recursive: true });
    await writeFile(
      path.join(repoPath, 'tests/foo.spec.ts'),
      'import { it } from "vitest";',
    );

    const result = await auditRepo(repoPath);
    const workflow = result.categories.find((c) => c.id === 'workflow');
    expect(workflow?.score).toBeGreaterThanOrEqual(10);
    const testing = result.categories.find((c) => c.id === 'testing');
    expect(testing?.score).toBeGreaterThan(0);
  });

  it('scores AGENTS.md plus cursor rules at 20', async () => {
    await writeFile(path.join(repoPath, 'AGENTS.md'), '# Agents\n');
    await mkdir(path.join(repoPath, '.cursor', 'rules'), { recursive: true });
    await writeFile(
      path.join(repoPath, '.cursor', 'rules', 'project.mdc'),
      '---\n',
    );
    await writeFile(path.join(repoPath, 'README.md'), '# Test\n');

    const result = await auditRepo(repoPath);
    const agent = result.categories.find((c) => c.id === 'agent-instructions');
    expect(agent?.score).toBe(20);
  });

  it('warns when AGENTS.md still contains starter placeholders', async () => {
    const { AGENTS_MD } = await import('../src/generate/templates.js');
    await writeFile(path.join(repoPath, 'AGENTS.md'), AGENTS_MD);
    await mkdir(path.join(repoPath, '.cursor', 'rules'), { recursive: true });
    await writeFile(
      path.join(repoPath, '.cursor', 'rules', 'project.mdc'),
      '---\n',
    );
    await writeFile(path.join(repoPath, 'README.md'), '# Test\n');

    const result = await auditRepo(repoPath);
    const agent = result.categories.find((c) => c.id === 'agent-instructions');
    expect(agent?.score).toBe(20);
    expect(
      agent?.findings.some(
        (f) =>
          f.status === 'warn' && f.message.includes('starter placeholders'),
      ),
    ).toBe(true);
  });
});
