import fg from 'fast-glob';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { isWithin } from './safePath.js';

/**
 * Glob for files under `repoPath`.
 *
 * Symlinked directories are never traversed, so a link such as `docs -> /`
 * cannot walk the audit across the filesystem or list files from outside the
 * repository in a report. That includes a directory named in the pattern
 * itself (`.github/workflows/*.yml` with `.github -> /elsewhere`), which
 * fast-glob would otherwise enter. Symlinked files are kept when their target is a
 * regular file inside the repository (for example `CLAUDE.md -> AGENTS.md`).
 */
export async function findFiles(
  repoPath: string,
  patterns: string | string[],
  options?: { ignore?: string[]; deep?: number },
): Promise<string[]> {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  const entries = await fg(patternList, {
    cwd: repoPath,
    absolute: true,
    dot: true,
    onlyFiles: false,
    followSymbolicLinks: false,
    objectMode: true,
    // A pattern such as `.clinerules/**/*.md` makes fast-glob scan
    // `.clinerules` as a directory; when it is a file that throws ENOTDIR.
    suppressErrors: true,
    deep: options?.deep ?? Infinity,
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
    if (entry.dirent.isFile()) {
      if (await inRepoDir(path.dirname(entry.path))) matches.push(entry.path);
    } else if (
      entry.dirent.isSymbolicLink() &&
      (await isRegularFileInside(realRepo, entry.path))
    ) {
      matches.push(entry.path);
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
