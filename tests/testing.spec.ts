import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkTesting } from '../src/audit/checks/testing.js';

describe('checkTesting', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-testing-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 in a repo with no testing signals', async () => {
    const result = await checkTesting(repoPath);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(15);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('scores full points with tests, config, CI, script, and coverage', async () => {
    await mkdir(path.join(repoPath, 'tests'), { recursive: true });
    await writeFile(path.join(repoPath, 'tests', 'example.spec.ts'), 'test');
    await writeFile(
      path.join(repoPath, 'vitest.config.ts'),
      'export default {}',
    );
    await mkdir(path.join(repoPath, '.github', 'workflows'), {
      recursive: true,
    });
    await writeFile(
      path.join(repoPath, '.github', 'workflows', 'ci.yml'),
      'name: CI',
    );
    await writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({ scripts: { test: 'vitest run' } }),
    );
    const result = await checkTesting(repoPath);
    expect(result.score).toBe(15);
    expect(result.findings.some((f) => f.status === 'pass')).toBe(true);
  });

  it('scores partial points for test files without config or CI', async () => {
    await writeFile(path.join(repoPath, 'app.test.ts'), 'test');
    const result = await checkTesting(repoPath);
    expect(result.score).toBe(5);
    expect(result.score).toBeLessThan(result.maxScore);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('detects jest coverage configuration', async () => {
    await writeFile(path.join(repoPath, 'app.test.js'), 'test');
    await writeFile(
      path.join(repoPath, 'jest.config.js'),
      'module.exports = { collectCoverage: true };',
    );
    const result = await checkTesting(repoPath);
    expect(
      result.findings.some(
        (f) => f.status === 'pass' && /coverage/i.test(f.message),
      ),
    ).toBe(true);
  });

  it('caps the score at maxScore', async () => {
    await mkdir(path.join(repoPath, 'tests'), { recursive: true });
    await writeFile(path.join(repoPath, 'tests', 'a.spec.ts'), 'test');
    await writeFile(path.join(repoPath, 'b.test.ts'), 'test');
    await writeFile(
      path.join(repoPath, 'vitest.config.ts'),
      'export default {}',
    );
    await mkdir(path.join(repoPath, '.github', 'workflows'), {
      recursive: true,
    });
    await writeFile(
      path.join(repoPath, '.github', 'workflows', 'ci.yml'),
      'name: CI',
    );
    await writeFile(path.join(repoPath, 'codecov.yml'), 'coverage: {}');
    await writeFile(
      path.join(repoPath, 'package.json'),
      JSON.stringify({ scripts: { test: 'vitest', 'test:e2e': 'pw' } }),
    );
    const result = await checkTesting(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
  });
});
