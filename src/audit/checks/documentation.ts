import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileExists } from '../../fs/fileExists.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;

const README_QUALITY_KEYWORDS = [
  'install',
  'usage',
  'getting started',
  'setup',
  'development',
  'contributing',
  'license',
  'overview',
];

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function checkDocumentation(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  // README quality
  const readmePath = path.join(repoPath, 'README.md');
  const readmeContent = await readFileSafe(readmePath);
  if (readmeContent) {
    const lower = readmeContent.toLowerCase();
    const keywordsFound = README_QUALITY_KEYWORDS.filter((kw) =>
      lower.includes(kw),
    );
    const lineCount = readmeContent.split('\n').length;

    if (keywordsFound.length >= 4 && lineCount >= 20) {
      score += 4;
      findings.push({
        status: 'pass',
        message: `README.md is well-structured (${lineCount} lines, ${keywordsFound.length} quality sections)`,
        files: ['README.md'],
      });
    } else if (keywordsFound.length >= 2 || lineCount >= 15) {
      score += 2;
      findings.push({
        status: 'warn',
        message: `README.md exists but could be more complete (${lineCount} lines, ${keywordsFound.length}/${README_QUALITY_KEYWORDS.length} quality sections)`,
        files: ['README.md'],
      });
    } else {
      score += 1;
      findings.push({
        status: 'warn',
        message: 'README.md is minimal — add setup, usage, and development sections',
        files: ['README.md'],
      });
    }
  } else {
    findings.push({ status: 'fail', message: 'README.md not found' });
  }

  // CHANGELOG
  const changelogPaths = ['CHANGELOG.md', 'CHANGELOG', 'HISTORY.md', 'docs/CHANGELOG.md'];
  let foundChangelog: string | null = null;
  for (const rel of changelogPaths) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundChangelog = rel;
      break;
    }
  }
  if (foundChangelog) {
    score += 3;
    findings.push({
      status: 'pass',
      message: `CHANGELOG found: ${foundChangelog}`,
      files: [foundChangelog],
    });
  } else {
    findings.push({ status: 'warn', message: 'No CHANGELOG.md found' });
  }

  // CONTRIBUTING
  const contributingPaths = ['CONTRIBUTING.md', 'docs/CONTRIBUTING.md', '.github/CONTRIBUTING.md'];
  let foundContributing: string | null = null;
  for (const rel of contributingPaths) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundContributing = rel;
      break;
    }
  }
  if (foundContributing) {
    score += 2;
    findings.push({
      status: 'pass',
      message: `CONTRIBUTING guide found: ${foundContributing}`,
      files: [foundContributing],
    });
  } else {
    findings.push({ status: 'warn', message: 'No CONTRIBUTING.md found' });
  }

  // CODE_OF_CONDUCT
  const cocPaths = ['CODE_OF_CONDUCT.md', '.github/CODE_OF_CONDUCT.md'];
  for (const rel of cocPaths) {
    if (await fileExists(path.join(repoPath, rel))) {
      score += 1;
      findings.push({
        status: 'pass',
        message: `Code of conduct found: ${rel}`,
        files: [rel],
      });
      break;
    }
  }

  score = Math.min(MAX_SCORE, score);

  if (score === 0) {
    findings.push({
      status: 'fail',
      message: 'No documentation files detected',
    });
  }

  return {
    id: 'documentation',
    label: 'Documentation coverage',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
