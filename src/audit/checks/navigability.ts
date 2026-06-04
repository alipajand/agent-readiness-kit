import path from 'node:path';
import { fileExists, dirExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;

const PRIMARY_NAV_DOCS: Array<{ rel: string; points: number }> = [
  { rel: 'docs/ROUTES.md', points: 2 },
  { rel: 'docs/API.md', points: 2 },
  { rel: 'docs/SCORING.md', points: 2 },
];

const SECONDARY_NAV_DOCS: Array<{ rel: string; points: number }> = [
  { rel: 'docs/SCHEMA.md', points: 1 },
  { rel: 'docs/DATA_MODEL.md', points: 1 },
];

// Glob patterns for nav docs nested in monorepo docs subdirectories
const PRIMARY_NAV_GLOBS: Array<{ pattern: string; label: string; points: number }> = [
  { pattern: 'docs/**/ROUTES.md', label: 'routes doc', points: 2 },
  { pattern: 'docs/**/*API*.md', label: 'API structure doc', points: 2 },
  { pattern: 'docs/**/*STRUCTURE*.md', label: 'structure doc', points: 1 },
];

const CLI_MODULE_DIRS = [
  'src/audit',
  'src/generate',
  'src/report',
  'src/config',
  'src/fs',
];

export async function checkNavigability(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  const scoredDocGlobs = new Set<string>();

  for (const { rel, points } of PRIMARY_NAV_DOCS) {
    if (await fileExists(path.join(repoPath, rel))) {
      score += points;
      scoredDocGlobs.add(rel);
      findings.push({
        status: 'pass',
        message: `Nav doc: ${rel}`,
        files: [rel],
      });
    }
  }

  for (const { rel, points } of SECONDARY_NAV_DOCS) {
    if (await fileExists(path.join(repoPath, rel))) {
      score += points;
      scoredDocGlobs.add(rel);
      findings.push({
        status: 'pass',
        message: `Nav doc: ${rel}`,
        files: [rel],
      });
    }
  }

  // Monorepo-aware: look for nav docs nested inside docs subdirectories
  for (const { pattern, label, points } of PRIMARY_NAV_GLOBS) {
    const matches = await findFiles(repoPath, pattern);
    const newMatches = matches.filter(
      (f) => !scoredDocGlobs.has(path.relative(repoPath, f)),
    );
    if (newMatches.length > 0) {
      score += points;
      const rels = newMatches.map((f) => path.relative(repoPath, f));
      rels.forEach((r) => scoredDocGlobs.add(r));
      findings.push({
        status: 'pass',
        message: `Nav doc (${label}): ${rels[0]}`,
        files: rels.slice(0, 3),
      });
    }
  }

  const openApi = await findFiles(repoPath, [
    '**/openapi.{yaml,yml,json}',
    '**/openapi/**/*.{yaml,yml,json}',
    'docs/openapi.{yaml,yml,json}',
  ]);
  if (openApi.length > 0) {
    score += 2;
    findings.push({
      status: 'pass',
      message: 'OpenAPI spec found',
      files: openApi.map((f) => path.relative(repoPath, f)).slice(0, 5),
    });
  }

  const routeConstants = await findFiles(repoPath, [
    '**/routes.ts',
    '**/routes.tsx',
    '**/routeConstants.ts',
    '**/paths.ts',
  ]);
  if (routeConstants.length > 0) {
    score += 1;
    findings.push({
      status: 'pass',
      message: 'Typed route constants or route modules found',
      files: routeConstants.map((f) => path.relative(repoPath, f)).slice(0, 5),
    });
  }

  const featureDirs = [
    path.join(repoPath, 'src', 'features'),
    path.join(repoPath, 'features'),
    path.join(repoPath, 'src', 'modules'),
  ];
  let foundFeatureDir = false;
  for (const dir of featureDirs) {
    if (await dirExists(dir)) {
      score += 2;
      foundFeatureDir = true;
      findings.push({
        status: 'pass',
        message: `Feature/module directory: ${path.relative(repoPath, dir)}`,
        files: [path.relative(repoPath, dir)],
      });
      break;
    }
  }
  // Monorepo-aware: check apps/*/features
  if (!foundFeatureDir) {
    // findFiles only returns files; check directory by looking for any file inside
    const appFeatureDirMatches = await findFiles(repoPath, 'apps/*/features/**/*');
    if (appFeatureDirMatches.length > 0) {
      score += 2;
      const exampleRel = path.dirname(
        path.relative(repoPath, appFeatureDirMatches[0]),
      ).split(path.sep).slice(0, 3).join(path.sep);
      findings.push({
        status: 'pass',
        message: `Feature/module directory (monorepo): ${exampleRel}`,
        files: [exampleRel],
      });
    }
  }

  const cliModulesFound: string[] = [];
  for (const rel of CLI_MODULE_DIRS) {
    if (await dirExists(path.join(repoPath, rel))) {
      cliModulesFound.push(rel);
    }
  }
  if (cliModulesFound.length >= 3) {
    score += 1;
    findings.push({
      status: 'pass',
      message: `CLI/module directories (${cliModulesFound.length}): ${cliModulesFound.join(', ')}`,
      files: cliModulesFound,
    });
  }
  if (cliModulesFound.length === CLI_MODULE_DIRS.length) {
    score += 1;
    findings.push({
      status: 'pass',
      message: 'Full CLI module layout detected',
      files: cliModulesFound,
    });
  }

  score = Math.min(MAX_SCORE, score);

  if (score === 0) {
    findings.push({
      status: 'fail',
      message:
        'No navigability docs (ROUTES, API, SCORING) or module layout detected',
    });
  } else if (score < 6) {
    findings.push({
      status: 'warn',
      message: 'Partial codebase navigability signals',
    });
  }

  return {
    id: 'navigability',
    label: 'Codebase navigability',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
