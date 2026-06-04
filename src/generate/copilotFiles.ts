import path from 'node:path';
import { writeFileSafe } from '../fs/writeFileSafe.js';
import type { WriteResult } from '../types.js';
import { COPILOT_INSTRUCTIONS_MD } from './templates.js';

export type GenerateOptions = { force?: boolean; repoPath: string };

export async function generateCopilot(
  options: GenerateOptions,
): Promise<WriteResult[]> {
  const filePath = path.join(
    options.repoPath,
    '.github',
    'copilot-instructions.md',
  );
  const result = await writeFileSafe(filePath, COPILOT_INSTRUCTIONS_MD, {
    force: options.force,
  });
  return [result];
}
