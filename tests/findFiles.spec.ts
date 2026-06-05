import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findFiles, relativeToRepo } from '../src/fs/findFiles.js';

describe('findFiles', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-findfiles-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('returns matching files as sorted absolute paths', async () => {
    await writeFile(path.join(repoPath, 'b.md'), '');
    await writeFile(path.join(repoPath, 'a.md'), '');
    const matches = await findFiles(repoPath, '*.md');
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => path.isAbsolute(m))).toBe(true);
    expect(matches).toEqual([...matches].sort());
  });

  it('returns an empty array when nothing matches', async () => {
    await writeFile(path.join(repoPath, 'a.txt'), '');
    expect(await findFiles(repoPath, '*.md')).toEqual([]);
  });

  it('accepts multiple patterns', async () => {
    await writeFile(path.join(repoPath, 'a.md'), '');
    await writeFile(path.join(repoPath, 'b.txt'), '');
    const matches = await findFiles(repoPath, ['*.md', '*.txt']);
    expect(matches).toHaveLength(2);
  });

  it('ignores node_modules, .git, and dist by default', async () => {
    await mkdir(path.join(repoPath, 'node_modules'), { recursive: true });
    await writeFile(path.join(repoPath, 'node_modules', 'x.md'), '');
    await mkdir(path.join(repoPath, 'dist'), { recursive: true });
    await writeFile(path.join(repoPath, 'dist', 'y.md'), '');
    await writeFile(path.join(repoPath, 'keep.md'), '');
    const matches = await findFiles(repoPath, '**/*.md');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.endsWith('keep.md')).toBe(true);
  });

  it('matches dotfiles', async () => {
    await writeFile(path.join(repoPath, '.gitignore'), '');
    const matches = await findFiles(repoPath, '.gitignore');
    expect(matches).toHaveLength(1);
  });

  it('honors a custom ignore list', async () => {
    await mkdir(path.join(repoPath, 'skip'), { recursive: true });
    await writeFile(path.join(repoPath, 'skip', 'a.md'), '');
    await writeFile(path.join(repoPath, 'b.md'), '');
    const matches = await findFiles(repoPath, '**/*.md', {
      ignore: ['**/skip/**'],
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.endsWith('b.md')).toBe(true);
  });
});

describe('relativeToRepo', () => {
  it('returns the path relative to the repo root', () => {
    const repo = path.join(path.sep, 'repo');
    const abs = path.join(repo, 'src', 'index.ts');
    expect(relativeToRepo(repo, abs)).toBe(path.join('src', 'index.ts'));
  });
});
