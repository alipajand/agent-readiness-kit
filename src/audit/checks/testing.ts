import path from 'node:path';
import { readTextFile } from '../../fs/readTextFile.js';
import { findFiles } from '../../fs/findFiles.js';
import { findTestFiles } from '../testFiles.js';
import {
  detectEcosystems,
  findInRepo,
  scoreEcosystemSignal,
  ECOSYSTEM_LABELS,
  type DetectedEcosystems,
  type EcosystemId,
  type SignalEvaluation,
} from '../ecosystems.js';
import {
  hasTomlTable,
  iniSections,
  readAutomationText,
  readRoot,
  readRootJson,
  readTaskSources,
  tomlTables,
} from '../projectFiles.js';
import { findRoleCommand, TASK_RUNNER_LIST } from './workflow.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 15;
const RUNNER_POINTS = 4;

type PackageJson = { scripts?: Record<string, string> };

const TEST_CONFIG_PATTERNS = [
  'vitest.config.*',
  '**/vitest.config.*',
  'jest.config.*',
  '**/jest.config.*',
  'playwright.config.*',
  '**/playwright.config.*',
  'cypress.config.*',
  '**/cypress.config.*',
];

const NODE_RUNNER_MISSING = 'No vitest/jest/playwright/cypress config found';
const PYTHON_RUNNER_MISSING =
  'No pytest configuration found (pytest.ini, conftest.py, [tool.pytest.ini_options], tox.ini, or noxfile.py)';

export async function checkTesting(
  repoPath: string,
  detected?: DetectedEcosystems,
): Promise<CategoryResult> {
  const ecosystems = detected ?? (await detectEcosystems(repoPath));
  const findings: Finding[] = [];
  let score = 0;

  // 1. Tests exist.
  const { files: testFiles, languages } = await findTestFiles(repoPath);
  if (testFiles.length > 0) {
    score += 5;
    findings.push({
      status: 'pass',
      message: `Test files found (${testFiles.length}): ${languages.join(', ')}`,
      files: testFiles.slice(0, 10).map((f) => path.relative(repoPath, f)),
    });
  } else {
    findings.push({ status: 'fail', message: 'No test files detected' });
  }

  // 2. A test runner is configured for each detected ecosystem.
  const nodeConfigs = async (): Promise<SignalEvaluation> => {
    const configs = await findFiles(repoPath, TEST_CONFIG_PATTERNS);
    return configs.length > 0
      ? {
          satisfied: true,
          passMessage: 'Test runner config found',
          files: configs.map((f) => path.relative(repoPath, f)),
        }
      : { satisfied: false, missingMessage: NODE_RUNNER_MISSING };
  };
  const pythonConfigs = async (): Promise<SignalEvaluation> => {
    const files = await findPytestConfig(repoPath);
    return files.length > 0
      ? {
          satisfied: true,
          passMessage: 'Python test runner config found (pytest/tox/nox)',
          files,
        }
      : { satisfied: false, missingMessage: PYTHON_RUNNER_MISSING };
  };
  const builtIn = (id: 'go' | 'rust'): SignalEvaluation => {
    const runner = id === 'go' ? 'go test' : 'cargo test';
    const hasTests = languages.includes(ECOSYSTEM_LABELS[id]);
    return hasTests
      ? {
          satisfied: true,
          passMessage: `${ECOSYSTEM_LABELS[id]} tests run with the built-in runner (${runner})`,
        }
      : {
          satisfied: false,
          missingMessage: `No ${ECOSYSTEM_LABELS[id]} tests for ${runner} to run`,
        };
  };
  const evaluateRunner = async (id: EcosystemId): Promise<SignalEvaluation> => {
    if (id === 'node') return nodeConfigs();
    if (id === 'python') return pythonConfigs();
    return builtIn(id);
  };

  const runner = await scoreEcosystemSignal(
    ecosystems,
    RUNNER_POINTS,
    evaluateRunner,
    async () => {
      const node = await nodeConfigs();
      if (node.satisfied) return node;
      const python = await pythonConfigs();
      if (python.satisfied) return python;
      return {
        satisfied: false,
        missingMessage:
          'No test runner config found (vitest, jest, playwright, cypress, or pytest)',
      };
    },
  );
  score += runner.points;
  for (const { evaluation } of runner.results) {
    findings.push(
      evaluation.satisfied
        ? {
            status: 'pass',
            message: evaluation.passMessage ?? 'Test runner configured',
            ...(evaluation.files ? { files: evaluation.files } : {}),
          }
        : {
            status: 'warn',
            message: evaluation.missingMessage ?? 'No test runner config',
          },
    );
  }

  // 3. Tests are verified in CI.
  const ciWorkflows = await findFiles(
    repoPath,
    '.github/workflows/*.{yml,yaml}',
  );
  if (ciWorkflows.length > 0) {
    score += 3;
    findings.push({
      status: 'pass',
      message: 'CI workflow present',
      files: ciWorkflows.map((f) => path.relative(repoPath, f)).slice(0, 5),
    });
  } else {
    findings.push({
      status: 'warn',
      message: 'No CI workflow in .github/workflows',
    });
  }

  // 4. A test command is defined (package.json script or task runner target).
  const pkg = await readRootJson<PackageJson>(repoPath, 'package.json');
  const scripts = pkg?.scripts ?? {};
  const hasTestScript =
    Boolean(scripts.test) ||
    Boolean(scripts['test:unit']) ||
    Boolean(scripts['test:e2e']);
  const sources = await readTaskSources(
    repoPath,
    ecosystems.manifests.node ?? [],
  );
  const runnerTest = findRoleCommand(
    sources.filter((s) => s.source !== 'package.json'),
    'test',
  );
  if (hasTestScript) {
    score += 2;
    findings.push({
      status: 'pass',
      message: 'package.json test script defined',
    });
  } else if (runnerTest) {
    score += 2;
    findings.push({
      status: 'pass',
      message: `Test command defined: ${runnerTest.name} (${runnerTest.source})`,
      files: [runnerTest.source],
    });
  } else {
    const nodeOnly =
      ecosystems.ids.length === 1 && ecosystems.ids[0] === 'node';
    findings.push({
      status: 'warn',
      message: nodeOnly
        ? 'No test script in package.json'
        : `No test command defined (${TASK_RUNNER_LIST})`,
    });
  }

  // 5. Coverage is configured.
  const coverageSource = await findCoverage(repoPath);
  if (coverageSource !== null) {
    score += 1;
    findings.push({
      status: 'pass',
      message: `Coverage configuration detected${coverageSource ? ` (${coverageSource})` : ''}`,
    });
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

/** Upper bound on nested pyproject.toml / setup.cfg files read for pytest config. */
const MAX_PYTHON_CONFIGS_READ = 50;

async function findPytestConfig(repoPath: string): Promise<string[]> {
  const files = await findInRepo(repoPath, [
    '**/pytest.ini',
    '**/conftest.py',
    '**/tox.ini',
    '**/noxfile.py',
  ]);
  for (const rel of (await findInRepo(repoPath, '**/pyproject.toml')).slice(
    0,
    MAX_PYTHON_CONFIGS_READ,
  )) {
    const content = await readTextFile(path.join(repoPath, rel));
    if (content && hasTomlTable(tomlTables(content), 'tool.pytest')) {
      files.push(rel);
    }
  }
  for (const rel of (await findInRepo(repoPath, '**/setup.cfg')).slice(
    0,
    MAX_PYTHON_CONFIGS_READ,
  )) {
    const content = await readTextFile(path.join(repoPath, rel));
    if (content && iniSections(content).includes('tool:pytest')) {
      files.push(rel);
    }
  }
  return [...new Set(files)].sort();
}

/**
 * Returns the coverage tool label ('' when the file name says enough), or
 * null when no coverage configuration is found.
 */
async function findCoverage(repoPath: string): Promise<string | null> {
  const coverageFiles = await findFiles(repoPath, [
    'codecov.yml',
    '.codecov.yml',
    '**/c8.config.*',
  ]);
  if (coverageFiles.length > 0) return '';
  if ((await findFiles(repoPath, 'vitest.config.*')).length > 0) {
    return 'vitest';
  }
  const jestConfigs = await findFiles(repoPath, [
    'jest.config.*',
    '**/jest.config.*',
  ]);
  for (const f of jestConfigs) {
    const src = await readTextFile(f);
    if (
      src !== null &&
      (src.includes('collectCoverage') ||
        src.includes('coverageProvider') ||
        src.includes('coverageThreshold') ||
        src.includes('coverageDirectory'))
    ) {
      return 'jest';
    }
  }

  if ((await findInRepo(repoPath, '**/.coveragerc')).length > 0) {
    return 'coverage.py';
  }
  const pyproject = await readRoot(repoPath, 'pyproject.toml');
  if (pyproject && hasTomlTable(tomlTables(pyproject), 'tool.coverage')) {
    return 'coverage.py';
  }
  const setupCfg = await readRoot(repoPath, 'setup.cfg');
  if (
    setupCfg &&
    iniSections(setupCfg).some((s) => s.startsWith('coverage:'))
  ) {
    return 'coverage.py';
  }
  if (
    (await findInRepo(repoPath, ['tarpaulin.toml', '.tarpaulin.toml'])).length >
    0
  ) {
    return 'tarpaulin';
  }
  const automation = await readAutomationText(repoPath);
  const goCover = automation
    .split('\n')
    .some(
      (line) =>
        line.includes('-coverprofile') ||
        (line.includes('go test') && /\s-cover\b/.test(line)),
    );
  if (goCover) return 'go test -cover';
  if (/\bcargo (?:tarpaulin|llvm-cov)\b/.test(automation)) return 'cargo';
  if (/--cov\b|--cov=|\bcoverage run\b/.test(automation)) return 'pytest-cov';
  return null;
}
