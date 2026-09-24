import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readRegularFile, readTextFile } from '../src/fs/readTextFile.js';
import { escapeMarkdown } from '../src/report/safeText.js';

describe('readRegularFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ark-read-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports why a file was not read', async () => {
    const file = path.join(dir, 'a.md');
    await writeFile(file, 'abc');
    expect(await readRegularFile(file)).toEqual({
      status: 'ok',
      content: 'abc',
    });
    expect(await readRegularFile(file, 2)).toEqual({ status: 'too-large' });
    expect(await readRegularFile(dir)).toEqual({ status: 'not-a-file' });
    expect(await readRegularFile(path.join(dir, 'nope'))).toEqual({
      status: 'missing',
    });
    expect(await readTextFile(path.join(dir, 'nope'))).toBeNull();
  });

  it.skipIf(process.platform === 'win32')(
    'does not wait on a FIFO',
    async () => {
      const fifo = path.join(dir, 'pipe.md');
      execFileSync('mkfifo', [fifo]);
      expect(await readRegularFile(fifo)).toEqual({ status: 'not-a-file' });
      expect(await readTextFile(fifo)).toBeNull();
    },
  );
});

describe('escapeMarkdown', () => {
  it('escapes backslashes so they cannot cancel an escaped pipe', () => {
    expect(escapeMarkdown('a\\|b')).toBe('a\\\\\\|b');
    expect(escapeMarkdown('<x>&y')).toBe('&lt;x&gt;&amp;y');
  });
});
