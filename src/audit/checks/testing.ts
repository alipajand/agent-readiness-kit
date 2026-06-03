import path from 'node:path';
import { findFiles } from '../../fs/findFiles.js';
import { readJsonFile } from '../../fs/writeFileSafe.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 15;

type PackageJson = { scripts?: Record<string, string> };

const TEST_CONFIG_PATTERNS = [
  'vitest.config.*',
  'jest.config.*',
  'playwright.config.*',
  'cypress.config.*',
];

const TEST_FILE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  'tests/**/*',
  'test/**/*',
  '__tests__/**/*',
];

export async function checkTesting(repoPath: string): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  const testFiles = await findFiles(repoPath, TEST_FILE_PATTERNS);
  if (testFiles.length > 0) {
    score += 5;
    findings.push({
      status: 'pass',
      message: `Test files found (${testFiles.length})`,
      files: testFiles.slice(0, 10).map((f) => path.relative(repoPath, f)),
    });
  } else {
    findings.push({ status: 'fail', message: 'No test files detected' });
  }

  const configs = await findFiles(repoPath, TEST_CONFIG_PATTERNS);
  if (configs.length > 0) {
    score += 4;
    findings.push({
      status: 'pass',
      message: 'Test runner config found',
      files: configs.map((f) => path.relative(repoPath, f)),
    });
  } else {
    findings.push({ status: 'warn', message: 'No vitest/jest/playwright/cypress config found' });
  }

  const ciWorkflows = await findFiles(repoPath, '.github/workflows/*.{yml,yaml}');
  const hasCi = ciWorkflows.some((f) => {
    const name = path.basename(f).toLowerCase();
    return name.includes('test') || name.includes('ci') || name.includes('build');
  });
  if (hasCi || ciWorkflows.length > 0) {
    score += 3;
    findings.push({
      status: 'pass',
      message: 'CI workflow present',
      files: ciWorkflows.map((f) => path.relative(repoPath, f)).slice(0, 5),
    });
  } else {
    findings.push({ status: 'warn', message: 'No CI workflow in .github/workflows' });
  }

  const pkg = await readJsonFile<PackageJson>(path.join(repoPath, 'package.json'));
  const scripts = pkg?.scripts ?? {};
  const hasTestScript =
    Boolean(scripts.test) ||
    Boolean(scripts['test:unit']) ||
    Boolean(scripts['test:e2e']);
  if (hasTestScript) {
    score += 2;
    findings.push({ status: 'pass', message: 'package.json test script defined' });
  } else {
    findings.push({ status: 'warn', message: 'No test script in package.json' });
  }

  const coverageFiles = await findFiles(repoPath, [
    'codecov.yml',
    '.codecov.yml',
    '**/c8.config.*',
  ]);
  const vitestConfig = await findFiles(repoPath, 'vitest.config.*');
  let hasCoverage = coverageFiles.length > 0;
  if (!hasCoverage && vitestConfig.length > 0) {
    hasCoverage = true;
    findings.push({ status: 'pass', message: 'Coverage tooling may be configured via vitest' });
  }
  if (hasCoverage) {
    score += 1;
    findings.push({ status: 'pass', message: 'Coverage configuration detected' });
  }

  score = Math.min(MAX_SCORE, score);

  return {
    id: 'testing',
    label: 'Testing and validation',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
