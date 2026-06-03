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
    ignore: options?.ignore ?? [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
    ],
  });
  return matches.sort();
}

export function relativeToRepo(repoPath: string, absolutePath: string): string {
  return path.relative(repoPath, absolutePath);
}
