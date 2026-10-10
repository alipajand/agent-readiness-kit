import { lstat, lstatSync, type PathLike } from 'node:fs';
import { lstat as lstatAsync, realpath, stat } from 'node:fs/promises';
import { glob, type FileSystemAdapter } from 'tinyglobby';
import path from 'node:path';
import { isWithin } from './safePath.js';

/**
 * tinyglobby either follows symlinks or drops them. Resolving each link to
 * itself and stat-ing it with lstat makes the walker report every symlink as
 * an entry without entering it, which is what `followSymbolicLinks: false`
 * means elsewhere: `CLAUDE.md -> AGENTS.md` is listed, `docs -> /` is not
 * walked.
 */
const reportSymlinksWithoutFollowing: FileSystemAdapter = {
  realpath: ((p: PathLike, callback: (error: null, resolved: string) => void) =>
    callback(null, String(p))) as unknown as FileSystemAdapter['realpath'],
  realpathSync: ((p: PathLike) =>
    String(p)) as unknown as FileSystemAdapter['realpathSync'],
  stat: lstat as unknown as FileSystemAdapter['stat'],
  statSync: lstatSync as unknown as FileSystemAdapter['statSync'],
};

/**
 * Glob for files under `repoPath`.
 *
 * Symlinked directories are never traversed, so a link such as `docs -> /`
 * cannot walk the audit across the filesystem or list files from outside the
 * repository in a report. That includes a directory named in the pattern
 * itself (`.github/workflows/*.yml` with `.github -> /elsewhere`), which
 * a glob would otherwise enter. Symlinked files are kept when their target is a
 * regular file inside the repository (for example `CLAUDE.md -> AGENTS.md`).
 */
export async function findFiles(
  repoPath: string,
  patterns: string | string[],
  options?: { ignore?: string[]; deep?: number },
): Promise<string[]> {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  const entries = await glob(patternList, {
    cwd: repoPath,
    absolute: true,
    dot: true,
    onlyFiles: false,
    followSymbolicLinks: true,
    fs: reportSymlinksWithoutFollowing,
    // `docs` names that directory only, not everything below it.
    expandDirectories: false,
    // tinyglobby counts the top level as depth 0.
    deep: (options?.deep ?? Infinity) - 1,
    ignore: options?.ignore ?? [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
    ],
  });

  const realRepo = await realpath(repoPath).catch(() => path.resolve(repoPath));
  const realDirs = new Map<string, Promise<boolean>>();
  const inRepoDir = (dir: string): Promise<boolean> => {
    let inside = realDirs.get(dir);
    if (!inside) {
      inside = realpath(dir).then(
        (real) => isWithin(realRepo, real),
        () => false,
      );
      realDirs.set(dir, inside);
    }
    return inside;
  };

  const matches: string[] = [];
  for (const entry of entries) {
    // Directories come back with a trailing slash.
    if (entry.endsWith('/')) continue;
    const entryPath = path.normalize(entry);
    const info = await lstatAsync(entryPath).catch(() => null);
    if (info?.isFile()) {
      if (await inRepoDir(path.dirname(entryPath))) matches.push(entryPath);
    } else if (
      info?.isSymbolicLink() &&
      (await isRegularFileInside(realRepo, entryPath))
    ) {
      matches.push(entryPath);
    }
  }
  return matches.sort();
}

async function isRegularFileInside(
  realRepo: string,
  linkPath: string,
): Promise<boolean> {
  try {
    const target = await realpath(linkPath);
    if (!isWithin(realRepo, target)) return false;
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

export function relativeToRepo(repoPath: string, absolutePath: string): string {
  return path.relative(repoPath, absolutePath);
}
