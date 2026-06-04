import path from 'node:path';
import { fileExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 5;

export async function checkContainerization(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  // Dockerfile
  const dockerfiles = await findFiles(repoPath, [
    'Dockerfile',
    'Dockerfile.*',
    '**/Dockerfile',
    '**/Dockerfile.*',
  ]);
  if (dockerfiles.length > 0) {
    score += 2;
    findings.push({
      status: 'pass',
      message: `Dockerfile found (${dockerfiles.length})`,
      files: dockerfiles.map((f) => path.relative(repoPath, f)).slice(0, 5),
    });
  } else {
    findings.push({ status: 'warn', message: 'No Dockerfile found' });
  }

  // docker-compose
  const composeFiles = await findFiles(repoPath, [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
    'docker-compose.*.yml',
    'docker-compose.*.yaml',
  ]);
  if (composeFiles.length > 0) {
    score += 2;
    findings.push({
      status: 'pass',
      message: 'Docker Compose config found',
      files: composeFiles.map((f) => path.relative(repoPath, f)).slice(0, 5),
    });
  }

  // .dockerignore
  if (await fileExists(path.join(repoPath, '.dockerignore'))) {
    score += 1;
    findings.push({
      status: 'pass',
      message: '.dockerignore found',
      files: ['.dockerignore'],
    });
  } else if (dockerfiles.length > 0) {
    findings.push({
      status: 'warn',
      message: 'Dockerfile present but no .dockerignore',
    });
  }

  score = Math.min(MAX_SCORE, score);

  if (score === 0) {
    findings.push({
      status: 'warn',
      message: 'No containerization config found (Dockerfile / docker-compose)',
    });
  }

  return {
    id: 'containerization',
    label: 'Containerization',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
