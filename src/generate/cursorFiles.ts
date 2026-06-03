import path from 'node:path';
import { writeFileSafe } from '../fs/writeFileSafe.js';
import type { WriteResult } from '../types.js';
import { CURSOR_PROJECT_MDC } from './templates.js';

export type GenerateOptions = { force?: boolean; repoPath: string };

export async function generateCursor(
  options: GenerateOptions,
): Promise<WriteResult[]> {
  const filePath = path.join(
    options.repoPath,
    '.cursor',
    'rules',
    'project.mdc',
  );
  const result = await writeFileSafe(filePath, CURSOR_PROJECT_MDC, {
    force: options.force,
  });
  return [result];
}
