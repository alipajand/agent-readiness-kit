import path from 'node:path';
import { writeFileSafe } from '../fs/writeFileSafe.js';
import type { WriteResult } from '../types.js';
import { AGENTS_MD, CODEX_TASK_PROMPT } from './templates.js';

export type GenerateOptions = { force?: boolean; repoPath: string };

export async function generateCodex(
  options: GenerateOptions,
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  const agentsPath = path.join(options.repoPath, 'AGENTS.md');
  const promptPath = path.join(
    options.repoPath,
    'docs',
    'prompts',
    'CODEX_TASK_PROMPT.md',
  );

  results.push(
    await writeFileSafe(agentsPath, AGENTS_MD, { force: options.force }),
  );
  results.push(
    await writeFileSafe(promptPath, CODEX_TASK_PROMPT, {
      force: options.force,
    }),
  );

  return results;
}
