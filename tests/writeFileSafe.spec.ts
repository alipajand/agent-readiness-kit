import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeFileSafe } from '../src/fs/writeFileSafe.js';
import { relativeToRepo } from '../src/fs/findFiles.js';

describe('writeFileSafe', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ark-write-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates new file', async () => {
    const filePath = path.join(dir, 'new.txt');
    const result = await writeFileSafe(filePath, 'hello');
    expect(result.status).toBe('created');
    expect(await readFile(filePath, 'utf8')).toBe('hello');
  });

  it('skips existing file without force', async () => {
    const filePath = path.join(dir, 'existing.txt');
    await writeFile(filePath, 'original');
    const result = await writeFileSafe(filePath, 'updated');
    expect(result.status).toBe('skipped');
    expect(await readFile(filePath, 'utf8')).toBe('original');
  });

  it('overwrites with force', async () => {
    const filePath = path.join(dir, 'existing.txt');
    await writeFile(filePath, 'original');
    const result = await writeFileSafe(filePath, 'updated', { force: true });
    expect(result.status).toBe('overwritten');
    expect(await readFile(filePath, 'utf8')).toBe('updated');
  });

  it('returns absolute paths suitable for repo-relative display', async () => {
    const filePath = path.join(dir, 'docs', 'ARCHITECTURE.md');
    const result = await writeFileSafe(filePath, '# Architecture\n');
    expect(result.status).toBe('created');
    expect(path.isAbsolute(result.path)).toBe(true);
    expect(relativeToRepo(dir, result.path)).toBe(
      path.join('docs', 'ARCHITECTURE.md'),
    );
  });
});
