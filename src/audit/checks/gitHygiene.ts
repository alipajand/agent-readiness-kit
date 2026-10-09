import path from 'node:path';
import { fileExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import {
  detectEcosystems,
  type DetectedEcosystems,
  type EcosystemId,
} from '../ecosystems.js';
import { readRoot, repoFileExists } from '../projectFiles.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;

type GitignoreItem = { label: string; alternatives: string[] };

const item = (label: string, ...alternatives: string[]): GitignoreItem => ({
  label,
  alternatives: alternatives.length > 0 ? alternatives : [label],
});

const UNIVERSAL_ITEMS = [item('.env'), item('.DS_Store')];

/**
 * Dependency and build-output entries a .gitignore should cover, per
 * ecosystem. Repositories with no detected ecosystem use the Node.js entries,
 * as before.
 */
const ECOSYSTEM_ITEMS: Record<EcosystemId, GitignoreItem[]> = {
  node: [item('node_modules'), item('dist')],
  python: [
    item('__pycache__', '__pycache__', '*.pyc', '*.py[cod]'),
    item('.venv', '.venv', 'venv'),
  ],
  go: [
    item('Go binaries', '*.exe', '*.test', '/bin', 'bin/'),
    item('Go coverage output', '*.out', 'coverage'),
  ],
  rust: [item('target'), item('debug', 'debug', '*.rs.bk', '*.pdb')],
};

export function gitignoreItems(ids: readonly EcosystemId[]): GitignoreItem[] {
  const own = (ids.length > 0 ? ids : (['node'] as const)).flatMap(
    (id) => ECOSYSTEM_ITEMS[id],
  );
  // Node.js lists node_modules and dist first; keep that order for its report.
  return ids.length === 0 || ids[0] === 'node'
    ? [...own, ...UNIVERSAL_ITEMS]
    : [...UNIVERSAL_ITEMS, ...own];
}

export async function checkGitHygiene(
  repoPath: string,
  detected?: DetectedEcosystems,
): Promise<CategoryResult> {
  const ecosystems = detected ?? (await detectEcosystems(repoPath));
  const findings: Finding[] = [];
  let score = 0;

  // .gitignore quality
  const gitignoreContent = await readRoot(repoPath, '.gitignore');
  if (gitignoreContent) {
    const lower = gitignoreContent.toLowerCase();
    const items = gitignoreItems(ecosystems.ids);
    const covered = items.filter((i) =>
      i.alternatives.some((a) => lower.includes(a.toLowerCase())),
    );
    const hits = covered.map((i) => i.label);
    // Comprehensive: at most one expected entry missing (3 of 4 for one stack).
    if (hits.length >= items.length - 1) {
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
        message: `.gitignore exists but may be missing common entries (${items
          .filter((i) => !covered.includes(i))
          .map((i) => i.label)
          .join(', ')})`,
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
    // Commit message linters outside the Node.js toolchain
    '.gitlint',
    'cog.toml',
    '.cz.toml',
    '.cz.json',
    '.cz.yaml',
  ];
  let foundCommitlint: string | null = null;
  for (const rel of commitlintFiles) {
    if (await repoFileExists(repoPath, rel)) {
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
    const hookConfigs = await findFiles(repoPath, [
      '.pre-commit-config.yaml',
      '.pre-commit-config.yml',
      'lefthook.yml',
      'lefthook.yaml',
      '.lefthook.yml',
      '.githooks/*',
    ]);
    if (huskyFiles.length > 0) {
      score += 1;
      findings.push({
        status: 'pass',
        message: 'Husky hooks directory found',
        files: huskyFiles.map((f) => path.relative(repoPath, f)).slice(0, 3),
      });
    } else if (hookConfigs.length > 0) {
      score += 1;
      const rel = path.relative(repoPath, hookConfigs[0]);
      findings.push({
        status: 'pass',
        message: `Git hooks configured: ${rel}`,
        files: [rel],
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
    '.goreleaser.yml',
    '.goreleaser.yaml',
    'release-please-config.json',
    'release.toml',
  ];
  let foundRelease: string | null = null;
  for (const rel of releaseFiles) {
    if (await repoFileExists(repoPath, rel)) {
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
