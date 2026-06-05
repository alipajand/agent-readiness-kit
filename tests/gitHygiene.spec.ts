import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkGitHygiene } from '../src/audit/checks/gitHygiene.js';

const GOOD_GITIGNORE = `node_modules/
dist/
.env
.DS_Store
*.log
`;

describe('checkGitHygiene', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-git-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 when no git hygiene signals exist', async () => {
    const result = await checkGitHygiene(repoPath);
    expect(result.score).toBe(0);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('awards 3 points for a comprehensive .gitignore', async () => {
    await writeFile(path.join(repoPath, '.gitignore'), GOOD_GITIGNORE);
    const result = await checkGitHygiene(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(
      result.findings.some((f) =>
        f.message.includes('.gitignore is comprehensive'),
      ),
    ).toBe(true);
  });

  it('awards partial points for a minimal .gitignore', async () => {
    await writeFile(path.join(repoPath, '.gitignore'), 'node_modules/\n');
    const result = await checkGitHygiene(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it('matches quality patterns case-insensitively (.DS_Store)', async () => {
    // node_modules + .env + .DS_Store (mixed case) => 3 comprehensive hits
    await writeFile(
      path.join(repoPath, '.gitignore'),
      'node_modules/\n.env\n.DS_Store\n',
    );
    const result = await checkGitHygiene(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(
      result.findings.some(
        (f) => f.status === 'pass' && f.message.includes('comprehensive'),
      ),
    ).toBe(true);
  });

  it('awards points for commitlint config', async () => {
    await writeFile(path.join(repoPath, '.gitignore'), GOOD_GITIGNORE);
    await writeFile(
      path.join(repoPath, 'commitlint.config.js'),
      "module.exports = { extends: ['@commitlint/config-conventional'] };\n",
    );
    const result = await checkGitHygiene(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(6);
    expect(result.findings.some((f) => f.message.includes('Commitlint'))).toBe(
      true,
    );
  });

  it('awards points for .gitattributes', async () => {
    await writeFile(path.join(repoPath, '.gitignore'), GOOD_GITIGNORE);
    await writeFile(path.join(repoPath, '.gitattributes'), '* text=auto\n');
    const result = await checkGitHygiene(repoPath);
    expect(
      result.findings.some((f) => f.message.includes('.gitattributes')),
    ).toBe(true);
  });

  it('caps score at maxScore', async () => {
    await writeFile(path.join(repoPath, '.gitignore'), GOOD_GITIGNORE);
    await writeFile(path.join(repoPath, 'commitlint.config.js'), '');
    await writeFile(path.join(repoPath, '.gitattributes'), '');
    await writeFile(path.join(repoPath, '.release-it.json'), '{}');
    const result = await checkGitHygiene(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
    expect(result.maxScore).toBe(10);
  });
});
