import path from 'node:path';
import { fileExists, dirExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import { readFile } from 'node:fs/promises';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 15;

const SAFETY_KEYWORDS = [
  'security',
  'secrets',
  'environment variable',
  'environment variables',
  '.env',
  'auth',
  'authorization',
  'tenant',
  'migration',
  'rollback',
  'production',
  'generated code',
];

const SAFETY_PATHS = [
  '.env.example',
  'SECURITY.md',
  'docs/security',
  'docs/operations',
  'docs/runbooks',
  'docs/migrations',
  'docs/MIGRATIONS.md',
];

async function fileMentionsSafety(filePath: string): Promise<boolean> {
  try {
    const content = (await readFile(filePath, 'utf8')).toLowerCase();
    return SAFETY_KEYWORDS.some((kw) => content.includes(kw.toLowerCase()));
  } catch {
    return false;
  }
}

export async function checkSafety(repoPath: string): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;
  const foundFiles: string[] = [];

  for (const rel of SAFETY_PATHS) {
    const full = path.join(repoPath, rel);
    if ((await fileExists(full)) || (await dirExists(full))) {
      foundFiles.push(rel);
      score += 3;
    }
  }
  score = Math.min(9, score);

  const docCandidates = await findFiles(repoPath, [
    'docs/**/*.md',
    'README.md',
    'AGENTS.md',
    'CONTRIBUTING.md',
  ]);
  let keywordHits = 0;
  const keywordFiles: string[] = [];
  for (const file of docCandidates.slice(0, 30)) {
    if (await fileMentionsSafety(file)) {
      keywordHits++;
      keywordFiles.push(path.relative(repoPath, file));
    }
  }

  if (keywordHits > 0) {
    score += Math.min(6, keywordHits * 2);
    findings.push({
      status: 'pass',
      message: `Docs mention safety topics (${keywordHits} files)`,
      files: keywordFiles.slice(0, 8),
    });
  }

  if (foundFiles.includes('.env.example')) {
    findings.push({ status: 'pass', message: '.env.example found', files: ['.env.example'] });
  } else {
    findings.push({ status: 'fail', message: '.env.example not found' });
  }

  if (foundFiles.includes('SECURITY.md')) {
    findings.push({ status: 'pass', message: 'SECURITY.md found', files: ['SECURITY.md'] });
  }

  for (const f of foundFiles) {
    if (f !== '.env.example' && f !== 'SECURITY.md') {
      findings.push({ status: 'pass', message: `Safety/ops doc: ${f}`, files: [f] });
    }
  }

  if (score < 5) {
    findings.push({
      status: 'warn',
      message: 'Limited safety boundary documentation for agents',
    });
  }

  score = Math.min(MAX_SCORE, score);

  return {
    id: 'safety',
    label: 'Safety boundaries',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
