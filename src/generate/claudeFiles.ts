import path from 'node:path';
import { writeFileSafe } from '../fs/writeFileSafe.js';
import type { WriteResult } from '../types.js';
import { CLAUDE_MD, CLAUDE_TASK_PROMPT } from './templates.js';

export type GenerateOptions = { force?: boolean; repoPath: string };

export async function generateClaude(options: GenerateOptions): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  const claudePath = path.join(options.repoPath, 'CLAUDE.md');
  const promptPath = path.join(options.repoPath, 'docs', 'prompts', 'CLAUDE_TASK_PROMPT.md');

  results.push(await writeFileSafe(claudePath, CLAUDE_MD, { force: options.force }));
  results.push(await writeFileSafe(promptPath, CLAUDE_TASK_PROMPT, { force: options.force }));

  return results;
}
