import path from 'node:path';
import { fileExists, dirExists } from '../../fs/fileExists.js';
import { readJsonFile } from '../../fs/writeFileSafe.js';
import {
  fileHasPlaceholderContent,
  PLACEHOLDER_WARNING,
} from '../placeholderDetection.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 15;

type PackageJson = {
  workspaces?: string[] | { packages?: string[] };
};

export async function checkArchitecture(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  const readme = path.join(repoPath, 'README.md');
  const hasReadme = await fileExists(readme);
  if (hasReadme) {
    score += 5;
    findings.push({
      status: 'pass',
      message: 'README.md found',
      files: ['README.md'],
    });
  } else {
    findings.push({
      status: 'fail',
      message: 'README.md not found (required for >5 points)',
    });
  }

  const archPaths = ['docs/ARCHITECTURE.md', 'docs/architecture.md'];
  let hasArchDoc = false;
  let archDocRel: string | null = null;
  for (const rel of archPaths) {
    if (await fileExists(path.join(repoPath, rel))) {
      hasArchDoc = true;
      archDocRel = rel;
      findings.push({
        status: 'pass',
        message: `Architecture doc: ${rel}`,
        files: [rel],
      });
      break;
    }
  }

  if (
    archDocRel &&
    (await fileHasPlaceholderContent(path.join(repoPath, archDocRel)))
  ) {
    findings.push({
      status: 'warn',
      message: `${PLACEHOLDER_WARNING} (${archDocRel})`,
      files: [archDocRel],
    });
  }

  const adrDirs = ['docs/adr', 'docs/decisions'];
  for (const rel of adrDirs) {
    if (await dirExists(path.join(repoPath, rel))) {
      hasArchDoc = true;
      findings.push({
        status: 'pass',
        message: `ADR/decisions directory: ${rel}`,
        files: [rel],
      });
      break;
    }
  }

  if (hasArchDoc) {
    score += 7;
  } else {
    findings.push({
      status: 'fail',
      message: 'No architecture doc or ADR directory (required for >10 points)',
    });
  }

  const appsDir = path.join(repoPath, 'apps');
  const packagesDir = path.join(repoPath, 'packages');
  const hasApps = await dirExists(appsDir);
  const hasPackages = await dirExists(packagesDir);

  const pkgPath = path.join(repoPath, 'package.json');
  const pkg = await readJsonFile<PackageJson>(pkgPath);
  const hasWorkspaces =
    pkg?.workspaces !== undefined &&
    (Array.isArray(pkg.workspaces) ? pkg.workspaces.length > 0 : true);

  if (hasApps && hasPackages) {
    score = Math.min(MAX_SCORE, score + 3);
    findings.push({
      status: 'pass',
      message: 'Monorepo layout: apps/ and packages/ directories',
      files: ['apps/', 'packages/'],
    });
  } else if (hasWorkspaces) {
    score = Math.min(MAX_SCORE, score + 2);
    findings.push({
      status: 'pass',
      message: 'pnpm/npm workspace configured in package.json',
    });
  }

  score = Math.min(MAX_SCORE, score);

  if (score >= 12) {
    findings.push({
      status: 'pass',
      message: `Architecture clarity score: ${score}/${MAX_SCORE}`,
    });
  } else if (score > 0) {
    findings.push({
      status: 'warn',
      message: `Partial architecture clarity: ${score}/${MAX_SCORE}`,
    });
  }

  return {
    id: 'architecture',
    label: 'Project architecture clarity',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
