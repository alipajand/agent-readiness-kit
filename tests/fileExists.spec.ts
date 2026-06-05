import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileExists, dirExists } from '../src/fs/fileExists.js';

describe('fileExists', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-fileexists-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns true for an existing file', async () => {
    const file = path.join(tmpDir, 'a.txt');
    await writeFile(file, 'hi');
    expect(await fileExists(file)).toBe(true);
  });

  it('returns false for a missing path', async () => {
    expect(await fileExists(path.join(tmpDir, 'nope.txt'))).toBe(false);
  });

  it('returns true for a directory (existence check)', async () => {
    expect(await fileExists(tmpDir)).toBe(true);
  });
});

describe('dirExists', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'ark-direxists-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns true for an existing directory', async () => {
    const dir = path.join(tmpDir, 'sub');
    await mkdir(dir);
    expect(await dirExists(dir)).toBe(true);
  });

  it('returns false for a missing directory', async () => {
    expect(await dirExists(path.join(tmpDir, 'missing'))).toBe(false);
  });
});
