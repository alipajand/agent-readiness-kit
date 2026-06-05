import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;

const GITIGNORE_QUALITY_PATTERNS = [
  'node_modules',
  'dist',
  '.env',
  '.DS_Store',
];

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function checkGitHygiene(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  // .gitignore quality
  const gitignorePath = path.join(repoPath, '.gitignore');
  const gitignoreContent = await readFileSafe(gitignorePath);
  if (gitignoreContent) {
    const lower = gitignoreContent.toLowerCase();
    const hits = GITIGNORE_QUALITY_PATTERNS.filter((p) =>
      lower.includes(p.toLowerCase()),
    );
    if (hits.length >= 3) {
      score += 3;
      findings.push({
        status: 'pass',
        message: `.gitignore is comprehensive (covers: ${hits.join(', ')})`,
        files: ['.gitignore'],
      });
    } else if (hits.length >= 1) {
      score += 2;
      findings.push({
        status: 'warn',
        message: `.gitignore exists but may be missing common entries (${GITIGNORE_QUALITY_PATTERNS.filter((p) => !lower.includes(p.toLowerCase())).join(', ')})`,
        files: ['.gitignore'],
      });
    } else {
      score += 1;
      findings.push({
        status: 'warn',
        message: '.gitignore is present but appears minimal',
        files: ['.gitignore'],
      });
    }
  } else {
    findings.push({ status: 'fail', message: 'No .gitignore found' });
  }

  // Conventional commits / commitlint
  const commitlintFiles = [
    'commitlint.config.js',
    'commitlint.config.cjs',
    'commitlint.config.mjs',
    'commitlint.config.ts',
    '.commitlintrc',
    '.commitlintrc.js',
    '.commitlintrc.cjs',
    '.commitlintrc.json',
    '.commitlintrc.yml',
    '.commitlintrc.yaml',
  ];
  let foundCommitlint: string | null = null;
  for (const rel of commitlintFiles) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundCommitlint = rel;
      break;
    }
  }
  if (foundCommitlint) {
    score += 3;
    findings.push({
      status: 'pass',
      message: `Commitlint config found: ${foundCommitlint}`,
      files: [foundCommitlint],
    });
  } else {
    // Check for conventional-commits reference in package.json scripts or husky
    const huskyFiles = await findFiles(repoPath, '.husky/**/*');
    if (huskyFiles.length > 0) {
      score += 1;
      findings.push({
        status: 'pass',
        message: 'Husky hooks directory found',
        files: huskyFiles.map((f) => path.relative(repoPath, f)).slice(0, 3),
      });
    } else {
      findings.push({
        status: 'warn',
        message: 'No commitlint config or git hooks found',
      });
    }
  }

  // .gitattributes
  if (await fileExists(path.join(repoPath, '.gitattributes'))) {
    score += 2;
    findings.push({
      status: 'pass',
      message: '.gitattributes found',
      files: ['.gitattributes'],
    });
  }

  // Release config (release-it, semantic-release, changesets)
  const releaseFiles = [
    '.release-it.js',
    '.release-it.cjs',
    '.release-it.json',
    '.release-it.yml',
    '.release-it.yaml',
    'release.config.js',
    'release.config.cjs',
  ];
  let foundRelease: string | null = null;
  for (const rel of releaseFiles) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundRelease = rel;
      break;
    }
  }
  const changesetDir = await fileExists(
    path.join(repoPath, '.changeset', 'config.json'),
  );
  const semRelConfig = await findFiles(repoPath, [
    '.releaserc',
    '.releaserc.json',
    '.releaserc.yml',
    '.releaserc.yaml',
    '.releaserc.js',
  ]);
  if (foundRelease || changesetDir || semRelConfig.length > 0) {
    score += 2;
    const label =
      foundRelease ??
      (changesetDir
        ? '.changeset/config.json'
        : path.relative(repoPath, semRelConfig[0]));
    findings.push({
      status: 'pass',
      message: `Release automation config found: ${label}`,
      files: [label],
    });
  }

  score = Math.min(MAX_SCORE, score);

  if (score === 0) {
    findings.push({
      status: 'fail',
      message: 'No git hygiene signals detected',
    });
  }

  return {
    id: 'git-hygiene',
    label: 'Git hygiene',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
