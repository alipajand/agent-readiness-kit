import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  auditRepo,
  auditCategory,
  ALL_CHECK_IDS,
} from '../src/audit/auditRepo.js';

const projectRoot = path.resolve(import.meta.dirname, '..');

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

  it('returns all category checks', async () => {
    const result = await auditRepo(repoPath);
    expect(result.categories).toHaveLength(ALL_CHECK_IDS.length);
    for (const id of ALL_CHECK_IDS) {
      expect(result.categories.some((c) => c.id === id)).toBe(true);
    }
  });

  it('caps total score at 100', async () => {
    const result = await auditRepo(projectRoot);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('auditCategory', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-cat-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('runs a known category by id', async () => {
    const cat = await auditCategory(projectRoot, 'workflow');
    expect(cat?.id).toBe('workflow');
    expect(cat?.score).toBeGreaterThanOrEqual(0);
    expect(cat?.findings.length).toBeGreaterThan(0);
  });

  it('returns null for an unknown category', async () => {
    expect(await auditCategory(repoPath, 'unknown-category')).toBeNull();
  });

  it('runs every registered check id', async () => {
    for (const id of ALL_CHECK_IDS) {
      const cat = await auditCategory(projectRoot, id);
      expect(cat?.id).toBe(id);
      expect(cat?.maxScore).toBeGreaterThan(0);
    }
  });
});

describe('auditRepo placeholders', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-audit-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
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
