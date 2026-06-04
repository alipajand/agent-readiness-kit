import path from 'node:path';
import { writeFileSafe } from '../fs/writeFileSafe.js';
import type { WriteResult } from '../types.js';
import {
  GITHUB_CI_WORKFLOW,
  GITHUB_PR_TEMPLATE,
  GITHUB_DEPENDABOT,
  GITHUB_ISSUE_BUG_TEMPLATE,
  GITHUB_ISSUE_FEATURE_TEMPLATE,
} from './templates.js';

export type GenerateOptions = { force?: boolean; repoPath: string };

export async function generateGithub(
  options: GenerateOptions,
): Promise<WriteResult[]> {
  const { repoPath, force } = options;

  const files: Array<{ rel: string; content: string }> = [
    {
      rel: path.join('.github', 'workflows', 'ci.yml'),
      content: GITHUB_CI_WORKFLOW,
    },
    {
      rel: path.join('.github', 'pull_request_template.md'),
      content: GITHUB_PR_TEMPLATE,
    },
    {
      rel: path.join('.github', 'dependabot.yml'),
      content: GITHUB_DEPENDABOT,
    },
    {
      rel: path.join('.github', 'ISSUE_TEMPLATE', 'bug_report.md'),
      content: GITHUB_ISSUE_BUG_TEMPLATE,
    },
    {
      rel: path.join('.github', 'ISSUE_TEMPLATE', 'feature_request.md'),
      content: GITHUB_ISSUE_FEATURE_TEMPLATE,
    },
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
