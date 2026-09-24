import { constants } from 'node:fs';
import { lstat, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { readTextFile } from './readTextFile.js';
import { isRealpathWithin, isWithin } from './safePath.js';
import type { WriteResult } from '../types.js';

export type WriteFileSafeOptions = {
  force?: boolean;
  /**
   * Directory the write must stay inside, including after following symlinks
   * in the existing part of the path. Generators pass the target repository.
   */
  root?: string;
};

// O_NOFOLLOW is undefined on Windows; the lstat check covers it there.
const WRITE_FLAGS =
  constants.O_WRONLY |
  constants.O_CREAT |
  constants.O_TRUNC |
  (constants.O_NOFOLLOW ?? 0);

/** Write `content` to `filePath` without following a symlink at the final component. */
export async function writeFileNoFollow(
  filePath: string,
  content: string,
): Promise<void> {
  const handle = await open(filePath, WRITE_FLAGS, 0o666);
  try {
    await handle.writeFile(content, 'utf8');
  } finally {
    await handle.close();
  }
}

/**
 * Create `filePath` unless it already exists (or `force` is set).
 *
 * A symlink at the target counts as existing and is never written through,
 * even with `force`: otherwise a repository could point `AGENTS.md` (or a
 * dangling link) at a file elsewhere on the machine and have it overwritten.
 * With `root`, writes that would land outside it are refused.
 */
export async function writeFileSafe(
  filePath: string,
  content: string,
  options: WriteFileSafeOptions = {},
): Promise<WriteResult> {
  const existing = await lstat(filePath).catch(() => null);
  if (existing && !options.force) {
    return { path: filePath, status: 'skipped' };
  }
  if (existing?.isSymbolicLink()) {
    return { path: filePath, status: 'refused', reason: 'symlink' };
  }

  if (
    options.root !== undefined &&
    !(
      isWithin(path.resolve(options.root), path.resolve(filePath)) &&
      isRealpathWithin(options.root, filePath)
    )
  ) {
    return { path: filePath, status: 'refused', reason: 'outside-repo' };
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileNoFollow(filePath, content);

  return {
    path: filePath,
    status: existing ? 'overwritten' : 'created',
  };
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  const raw = await readTextFile(filePath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
