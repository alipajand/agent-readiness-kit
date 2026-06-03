import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from './fileExists.js';
import type { WriteResult } from '../types.js';

export type WriteFileSafeOptions = {
  force?: boolean;
};

export async function writeFileSafe(
  filePath: string,
  content: string,
  options: WriteFileSafeOptions = {},
): Promise<WriteResult> {
  const exists = await fileExists(filePath);
  if (exists && !options.force) {
    return { path: filePath, status: 'skipped' };
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');

  return {
    path: filePath,
    status: exists ? 'overwritten' : 'created',
  };
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
