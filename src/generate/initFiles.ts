import path from 'node:path';
import { writeFileSafe } from '../fs/writeFileSafe.js';
import type { WriteResult } from '../types.js';
import {
  AGENTS_MD,
  ARCHITECTURE_MD,
  QA_AUDIT_PROMPT,
  FEATURE_IMPLEMENTATION_PROMPT,
  REFACTOR_PROMPT,
} from './templates.js';

export type InitOptions = { force?: boolean; repoPath: string };

const INIT_FILES: Array<{ rel: string; content: string }> = [
  { rel: 'AGENTS.md', content: AGENTS_MD },
  { rel: 'docs/ARCHITECTURE.md', content: ARCHITECTURE_MD },
  { rel: 'docs/prompts/QA_AUDIT_PROMPT.md', content: QA_AUDIT_PROMPT },
  {
    rel: 'docs/prompts/FEATURE_IMPLEMENTATION_PROMPT.md',
    content: FEATURE_IMPLEMENTATION_PROMPT,
  },
  { rel: 'docs/prompts/REFACTOR_PROMPT.md', content: REFACTOR_PROMPT },
];

export async function runInit(options: InitOptions): Promise<WriteResult[]> {
  const { repoPath, force } = options;
  const results: WriteResult[] = [];

  for (const { rel, content } of INIT_FILES) {
    const filePath = path.join(repoPath, rel);
    const result = await writeFileSafe(filePath, content, { force });
    results.push(result);
  }

  return results;
}
