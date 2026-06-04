import path from 'node:path';
import { fileExists, dirExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import { readJsonFile } from '../../fs/writeFileSafe.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;

type PackageJson = {
  engines?: Record<string, string>;
};

export async function checkDependencies(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  // Lockfile
  const lockfiles = [
    { rel: 'pnpm-lock.yaml', label: 'pnpm-lock.yaml' },
    { rel: 'package-lock.json', label: 'package-lock.json' },
    { rel: 'yarn.lock', label: 'yarn.lock' },
    { rel: 'bun.lockb', label: 'bun.lockb' },
  ];
  let foundLockfile: string | null = null;
  for (const { rel, label } of lockfiles) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundLockfile = label;
      break;
    }
  }
  if (foundLockfile) {
    score += 3;
    findings.push({
      status: 'pass',
      message: `Lockfile present: ${foundLockfile}`,
      files: [foundLockfile],
    });
  } else {
    findings.push({ status: 'fail', message: 'No lockfile found (pnpm-lock.yaml / package-lock.json / yarn.lock)' });
  }

  // Node version pin
  const nodeVersionFiles = ['.nvmrc', '.node-version', '.tool-versions'];
  let foundNodePin: string | null = null;
  for (const rel of nodeVersionFiles) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundNodePin = rel;
      break;
    }
  }
  const pkg = await readJsonFile<PackageJson>(path.join(repoPath, 'package.json'));
  const hasEngines = pkg?.engines && Object.keys(pkg.engines).length > 0;
  if (foundNodePin) {
    score += 2;
    findings.push({
      status: 'pass',
      message: `Node version pinned: ${foundNodePin}`,
      files: [foundNodePin],
    });
  } else if (hasEngines) {
    score += 2;
    findings.push({
      status: 'pass',
      message: 'Node version constrained via package.json engines field',
      files: ['package.json'],
    });
  } else {
    findings.push({
      status: 'warn',
      message: 'No Node.js version pin (.nvmrc, .node-version, or engines in package.json)',
    });
  }

  // Dependabot or Renovate
  const depbotPaths = [
    '.github/dependabot.yml',
    '.github/dependabot.yaml',
  ];
  let foundDepbot: string | null = null;
  for (const rel of depbotPaths) {
    if (await fileExists(path.join(repoPath, rel))) {
      foundDepbot = rel;
      break;
    }
  }
  const renovateFiles = await findFiles(repoPath, [
    'renovate.json',
    'renovate.json5',
    '.renovaterc',
    '.renovaterc.json',
  ]);
  if (foundDepbot) {
    score += 3;
    findings.push({
      status: 'pass',
      message: `Dependabot config found: ${foundDepbot}`,
      files: [foundDepbot],
    });
  } else if (renovateFiles.length > 0) {
    score += 3;
    findings.push({
      status: 'pass',
      message: 'Renovate config found',
      files: renovateFiles.map((f) => path.relative(repoPath, f)).slice(0, 3),
    });
  } else {
    findings.push({
      status: 'warn',
      message: 'No automated dependency update config (dependabot.yml or renovate.json)',
    });
  }

  // .npmrc or .pnpmfile.cjs — registry / workspace config
  const registryFiles = ['.npmrc', '.pnpmfile.cjs'];
  for (const rel of registryFiles) {
    if (await fileExists(path.join(repoPath, rel))) {
      score += 1;
      findings.push({
        status: 'pass',
        message: `Package manager config: ${rel}`,
        files: [rel],
      });
      break;
    }
  }

  // Workspaces root — check for monorepo package manager config
  const hasWorkspaceRoot =
    (await dirExists(path.join(repoPath, 'packages'))) ||
    (await dirExists(path.join(repoPath, 'apps')));
  const hasPnpmWorkspace = await fileExists(
    path.join(repoPath, 'pnpm-workspace.yaml'),
  );
  if (hasWorkspaceRoot && hasPnpmWorkspace) {
    score += 1;
    findings.push({
      status: 'pass',
      message: 'pnpm-workspace.yaml present in monorepo',
      files: ['pnpm-workspace.yaml'],
    });
  }

  score = Math.min(MAX_SCORE, score);

  if (score === 0) {
    findings.push({
      status: 'fail',
      message: 'No dependency hygiene signals detected',
    });
  } else if (score < 5) {
    findings.push({
      status: 'warn',
      message: 'Limited dependency hygiene configuration',
    });
  }

  return {
    id: 'dependencies',
    label: 'Dependency hygiene',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
