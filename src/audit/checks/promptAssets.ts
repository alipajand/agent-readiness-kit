import path from 'node:path';
import { dirExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import { fileHasPlaceholderContent, PLACEHOLDER_WARNING } from '../placeholderDetection.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;

const PROMPT_NAME_PATTERNS = [
  /qa/i,
  /refactor/i,
  /bugfix/i,
  /bug.?fix/i,
  /feature/i,
  /task/i,
  /audit/i,
];

export async function checkPromptAssets(repoPath: string): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  const promptDirs = [
    path.join(repoPath, 'docs', 'prompts'),
    path.join(repoPath, 'prompts'),
    path.join(repoPath, '.cursor', 'rules'),
  ];

  for (const dir of promptDirs) {
    if (await dirExists(dir)) {
      score += 2;
      findings.push({
        status: 'pass',
        message: `Prompt directory: ${path.relative(repoPath, dir)}`,
        files: [path.relative(repoPath, dir)],
      });
    }
  }

  const promptFiles = await findFiles(repoPath, [
    'docs/prompts/**/*.{md,mdc,txt}',
    'prompts/**/*.{md,mdc,txt}',
    '.cursor/rules/**/*.{md,mdc}',
  ]);

  if (promptFiles.length > 0) {
    score += 2;
    findings.push({
      status: 'pass',
      message: `Prompt/template files found (${promptFiles.length})`,
      files: promptFiles.map((f) => path.relative(repoPath, f)).slice(0, 10),
    });
  }

  const docsPromptFiles = promptFiles.filter((f) => {
    const rel = path.relative(repoPath, f);
    return rel.startsWith(`docs${path.sep}prompts${path.sep}`) && rel.endsWith('.md');
  });
  for (const file of docsPromptFiles) {
    const rel = path.relative(repoPath, file);
    if (await fileHasPlaceholderContent(file)) {
      findings.push({
        status: 'warn',
        message: `${PLACEHOLDER_WARNING} (${rel})`,
        files: [rel],
      });
    }
  }

  const categorized = promptFiles.filter((f) => {
    const base = path.basename(f);
    return PROMPT_NAME_PATTERNS.some((re) => re.test(base));
  });

  if (categorized.length > 0) {
    score += 3;
    findings.push({
      status: 'pass',
      message: 'Reusable task prompts (QA/refactor/bugfix/feature) detected',
      files: categorized.map((f) => path.relative(repoPath, f)).slice(0, 8),
    });
  } else if (promptFiles.length > 0) {
    findings.push({
      status: 'warn',
      message: 'Prompt files exist but no named QA/refactor/bugfix templates detected',
    });
  }

  const hasQa = promptFiles.some((f) => /qa/i.test(path.basename(f)));
  if (!hasQa) {
    findings.push({ status: 'warn', message: 'No reusable QA prompt template detected' });
  } else {
    score += 1;
  }

  score = Math.min(MAX_SCORE, score);

  if (score === 0) {
    findings.push({
      status: 'fail',
      message: 'No docs/prompts or .cursor/rules prompt assets found',
    });
  }

  return {
    id: 'prompt-assets',
    label: 'Prompt assets',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
