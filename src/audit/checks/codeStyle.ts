import path from 'node:path';
import { fileExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;

export async function checkCodeStyle(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  // ESLint
  const eslintFiles = [
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.mjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
  ];
  let foundEslint: string | null = null;
  for (const rel of eslintFiles) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundEslint = rel;
      break;
    }
  }
  if (foundEslint) {
    score += 3;
    findings.push({
      status: 'pass',
      message: `ESLint config found: ${foundEslint}`,
      files: [foundEslint],
    });
  } else {
    findings.push({ status: 'warn', message: 'No ESLint config detected' });
  }

  // Prettier
  const prettierFiles = [
    '.prettierrc',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.toml',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
    'prettier.config.ts',
  ];
  let foundPrettier: string | null = null;
  for (const rel of prettierFiles) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundPrettier = rel;
      break;
    }
  }
  if (foundPrettier) {
    score += 3;
    findings.push({
      status: 'pass',
      message: `Prettier config found: ${foundPrettier}`,
      files: [foundPrettier],
    });
  } else {
    findings.push({ status: 'warn', message: 'No Prettier config detected' });
  }

  // .editorconfig
  if (await fileExists(path.join(repoPath, '.editorconfig'))) {
    score += 2;
    findings.push({
      status: 'pass',
      message: '.editorconfig found',
      files: ['.editorconfig'],
    });
  } else {
    findings.push({ status: 'warn', message: 'No .editorconfig found' });
  }

  // .prettierignore or .eslintignore
  const ignoreFiles = ['.prettierignore', '.eslintignore'];
  for (const rel of ignoreFiles) {
    if (await fileExists(path.join(repoPath, rel))) {
      score += 1;
      findings.push({
        status: 'pass',
        message: `Ignore file: ${rel}`,
        files: [rel],
      });
    }
  }

  // Biome / oxc — alternative all-in-one linters
  const biomeFiles = await findFiles(repoPath, ['biome.json', 'biome.jsonc']);
  if (biomeFiles.length > 0) {
    score += 3;
    findings.push({
      status: 'pass',
      message: 'Biome config found (lint + format)',
      files: biomeFiles.map((f) => path.relative(repoPath, f)).slice(0, 3),
    });
  }

  score = Math.min(MAX_SCORE, score);

  if (score === 0) {
    findings.push({
      status: 'fail',
      message: 'No code style tooling detected (ESLint / Prettier / Biome / .editorconfig)',
    });
  }

  return {
    id: 'code-style',
    label: 'Code style tooling',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
