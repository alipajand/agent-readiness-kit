import path from 'node:path';
import { writeFileSafe } from '../fs/writeFileSafe.js';
import type { WriteResult } from '../types.js';
import {
  CLAUDE_MD,
  CLAUDE_SETTINGS_JSON,
  CLAUDE_TASK_PROMPT,
  CLAUDE_VERIFY_COMMAND_MD,
} from './templates.js';

export type GenerateOptions = { force?: boolean; repoPath: string };

export async function generateClaude(
  options: GenerateOptions,
): Promise<WriteResult[]> {
  const files: Array<[string[], string]> = [
    [['CLAUDE.md'], CLAUDE_MD],
    [['docs', 'prompts', 'CLAUDE_TASK_PROMPT.md'], CLAUDE_TASK_PROMPT],
    [['.claude', 'settings.json'], CLAUDE_SETTINGS_JSON],
    [['.claude', 'commands', 'verify.md'], CLAUDE_VERIFY_COMMAND_MD],
  ];

  const results: WriteResult[] = [];
  for (const [segments, content] of files) {
    results.push(
      await writeFileSafe(path.join(options.repoPath, ...segments), content, {
        force: options.force,
        root: options.repoPath,
      }),
    );
  }
  return results;
}
