import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveRepoPath(repoPath: string, ...segments: string[]): string {
  return path.join(repoPath, ...segments);
}
