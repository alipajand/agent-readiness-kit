import path from 'node:path';
import { writeFileSafe } from '../fs/writeFileSafe.js';
import type { WriteResult } from '../types.js';
import {
  VSCODE_SETTINGS,
  VSCODE_EXTENSIONS,
  VSCODE_LAUNCH,
} from './templates.js';

export type GenerateOptions = { force?: boolean; repoPath: string };

export async function generateVscode(
  options: GenerateOptions,
): Promise<WriteResult[]> {
  const { repoPath, force } = options;

  const files: Array<{ rel: string; content: string }> = [
    { rel: path.join('.vscode', 'settings.json'), content: VSCODE_SETTINGS },
    { rel: path.join('.vscode', 'extensions.json'), content: VSCODE_EXTENSIONS },
    { rel: path.join('.vscode', 'launch.json'), content: VSCODE_LAUNCH },
  ];

  const results: WriteResult[] = [];
  for (const { rel, content } of files) {
    const result = await writeFileSafe(path.join(repoPath, rel), content, {
      force,
    });
    results.push(result);
  }
  return results;
}
