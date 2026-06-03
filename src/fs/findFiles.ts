import fg from 'fast-glob';
import path from 'node:path';

export async function findFiles(
  repoPath: string,
  patterns: string | string[],
  options?: { ignore?: string[] },
): Promise<string[]> {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  const cwd = repoPath;
  const matches = await fg(patternList, {
    cwd,
    absolute: true,
    dot: true,
    onlyFiles: true,
    ignore: options?.ignore ?? ['**/node_modules/**', '**/.git/**', '**/dist/**'],
  });
  return matches.sort();
}

export async function findDirs(repoPath: string, patterns: string | string[]): Promise<string[]> {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  const matches = await fg(patternList, {
    cwd: repoPath,
    absolute: true,
    dot: true,
    onlyDirectories: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });
  return matches.sort();
}

export function relativeToRepo(repoPath: string, absolutePath: string): string {
  return path.relative(repoPath, absolutePath);
}
