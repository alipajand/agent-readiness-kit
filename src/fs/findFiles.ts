import fg from 'fast-glob';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { isWithin } from './safePath.js';

/**
 * Glob for files under `repoPath`.
 *
 * Symlinked directories are never traversed, so a link such as `docs -> /`
 * cannot walk the audit across the filesystem or list files from outside the
 * repository in a report. Symlinked files are kept when their target is a
 * regular file inside the repository (for example `CLAUDE.md -> AGENTS.md`).
 */
export async function findFiles(
  repoPath: string,
  patterns: string | string[],
  options?: { ignore?: string[] },
): Promise<string[]> {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  const entries = await fg(patternList, {
    cwd: repoPath,
    absolute: true,
    dot: true,
    onlyFiles: false,
    followSymbolicLinks: false,
    objectMode: true,
    ignore: options?.ignore ?? [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
    ],
  });

  const realRepo = await realpath(repoPath).catch(() => path.resolve(repoPath));
  const matches: string[] = [];
  for (const entry of entries) {
    if (entry.dirent.isFile()) {
      matches.push(entry.path);
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
