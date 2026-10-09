import path from 'node:path';
import { fileExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import {
  detectEcosystems,
  findInRepo,
  scoreEcosystemSignal,
  ECOSYSTEM_IDS,
  type DetectedEcosystems,
  type EcosystemId,
  type SignalEvaluation,
  type SignalOutcome,
} from '../ecosystems.js';
import {
  hasTomlTable,
  iniSections,
  readAutomationText,
  readRoot,
  repoFileExists,
  tomlTables,
} from '../projectFiles.js';
import { readTextFile } from '../../fs/readTextFile.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;
const LINTER_POINTS = 3;
const FORMATTER_POINTS = 3;

const ESLINT_FILES = [
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

const PRETTIER_FILES = [
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

const LINTER_MISSING: Record<EcosystemId, string> = {
  node: 'No ESLint config detected',
  python: 'No Python linter config detected (ruff, flake8, or pylint)',
  go: 'No Go linter detected (.golangci.yml, or go vet / staticcheck in a task or CI)',
  rust: 'No Rust linter detected (clippy config, [lints.clippy], or cargo clippy in a task or CI)',
};

const FORMATTER_MISSING: Record<EcosystemId, string> = {
  node: 'No Prettier config detected',
  python: 'No Python formatter detected (ruff format or black)',
  go: 'No Go formatter step detected (gofmt, gofumpt, or goimports in a task, hook, or CI)',
  rust: 'No Rust formatter detected (rustfmt.toml, or cargo fmt in a task, hook, or CI)',
};

export async function checkCodeStyle(
  repoPath: string,
  detected?: DetectedEcosystems,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  const ecosystems = detected ?? (await detectEcosystems(repoPath));
  const automation = await readAutomationText(repoPath);
  const pyTables = await pyprojectTables(repoPath);

  const linters = await scoreEcosystemSignal(
    ecosystems,
    LINTER_POINTS,
    (id) => evaluateLinter(repoPath, id, automation, pyTables),
    () =>
      anyEcosystem((id) => evaluateLinter(repoPath, id, automation, pyTables)),
  );
  score += linters.points;
  pushResults(findings, linters.results, 'linter');

  const formatters = await scoreEcosystemSignal(
    ecosystems,
    FORMATTER_POINTS,
    (id) => evaluateFormatter(repoPath, id, automation, pyTables),
    () =>
      anyEcosystem((id) =>
        evaluateFormatter(repoPath, id, automation, pyTables),
      ),
  );
  score += formatters.points;
  pushResults(findings, formatters.results, 'formatter');

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
    const nodeOrUnknown =
      ecosystems.ids.length === 0 ||
      (ecosystems.ids.length === 1 && ecosystems.ids[0] === 'node');
    findings.push({
      status: 'fail',
      message: nodeOrUnknown
        ? 'No code style tooling detected (ESLint / Prettier / Biome / .editorconfig)'
        : 'No code style tooling detected (linter, formatter, or .editorconfig)',
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

type PyTables = Map<string, string[]> | null;

async function pyprojectTables(repoPath: string): Promise<PyTables> {
  const content = await readRoot(repoPath, 'pyproject.toml');
  return content === null ? null : tomlTables(content);
}

/** Root config first (as before), then configs in nested packages. */
async function findConfig(
  repoPath: string,
  names: string[],
): Promise<string | null> {
  for (const rel of names) {
    if (await repoFileExists(repoPath, rel)) return rel;
  }
  const nested = await findInRepo(
    repoPath,
    names.map((n) => `**/${n}`),
  );
  return nested[0] ?? null;
}

async function evaluateLinter(
  repoPath: string,
  id: EcosystemId,
  automation: string,
  pyTables: PyTables,
): Promise<SignalEvaluation> {
  const pass = (message: string, file?: string): SignalEvaluation => ({
    satisfied: true,
    passMessage: message,
    ...(file ? { files: [file] } : {}),
  });
  const missing = { satisfied: false, missingMessage: LINTER_MISSING[id] };

  if (id === 'node') {
    const eslint = await findConfig(repoPath, ESLINT_FILES);
    return eslint ? pass(`ESLint config found: ${eslint}`, eslint) : missing;
  }
  if (id === 'python') {
    const file = await findConfig(repoPath, [
      'ruff.toml',
      '.ruff.toml',
      '.flake8',
      '.pylintrc',
      'pylintrc',
    ]);
    if (file) return pass(`Python linter config found: ${file}`, file);
    if (pyTables) {
      for (const table of ['tool.ruff', 'tool.pylint', 'tool.flake8']) {
        if (hasTomlTable(pyTables, table)) {
          return pass(
            `Python linter config found: pyproject.toml [${table}]`,
            'pyproject.toml',
          );
        }
      }
    }
    for (const rel of ['setup.cfg', 'tox.ini']) {
      const content = await readRoot(repoPath, rel);
      if (content && iniSections(content).includes('flake8')) {
        return pass(`Python linter config found: ${rel} [flake8]`, rel);
      }
    }
    if (/\bruff check\b|\bflake8\b|\bpylint\b/.test(automation)) {
      return pass('Python linter runs in a task, hook, or CI');
    }
    return missing;
  }
  if (id === 'go') {
    const file = await findConfig(repoPath, [
      '.golangci.yml',
      '.golangci.yaml',
      '.golangci.toml',
      '.golangci.json',
    ]);
    if (file) return pass(`golangci-lint config found: ${file}`, file);
    if (/\bgolangci-lint\b|\bgo vet\b|\bstaticcheck\b/.test(automation)) {
      return pass('Go linter runs in a task, hook, or CI');
    }
    return missing;
  }
  const clippy = await findConfig(repoPath, ['clippy.toml', '.clippy.toml']);
  if (clippy) return pass(`Clippy config found: ${clippy}`, clippy);
  const cargo = await readRoot(repoPath, 'Cargo.toml');
  if (
    cargo &&
    (hasTomlTable(tomlTables(cargo), 'lints.clippy') ||
      hasTomlTable(tomlTables(cargo), 'workspace.lints.clippy'))
  ) {
    return pass('Clippy lints configured in Cargo.toml', 'Cargo.toml');
  }
  if (/\bcargo clippy\b|\bclippy\b/.test(automation)) {
    return pass('Clippy runs in a task, hook, or CI');
  }
  return missing;
}

async function evaluateFormatter(
  repoPath: string,
  id: EcosystemId,
  automation: string,
  pyTables: PyTables,
): Promise<SignalEvaluation> {
  const pass = (message: string, file?: string): SignalEvaluation => ({
    satisfied: true,
    passMessage: message,
    ...(file ? { files: [file] } : {}),
  });
  const missing = { satisfied: false, missingMessage: FORMATTER_MISSING[id] };

  if (id === 'node') {
    const prettier = await findConfig(repoPath, PRETTIER_FILES);
    return prettier
      ? pass(`Prettier config found: ${prettier}`, prettier)
      : missing;
  }
  if (id === 'python') {
    if (pyTables) {
      for (const table of ['tool.black', 'tool.ruff.format']) {
        if (hasTomlTable(pyTables, table)) {
          return pass(
            `Python formatter config found: pyproject.toml [${table}]`,
            'pyproject.toml',
          );
        }
      }
    }
    for (const rel of ['ruff.toml', '.ruff.toml']) {
      const content = await readRoot(repoPath, rel);
      if (content && hasTomlTable(tomlTables(content), 'format')) {
        return pass(`Python formatter config found: ${rel} [format]`, rel);
      }
    }
    if (
      /\bruff format\b|\bruff-format\b|psf\/black|(?:^|[\s"'])black(?:\s|$)/m.test(
        automation,
      )
    ) {
      return pass('Python formatter runs in a task, hook, or CI');
    }
    return missing;
  }
  if (id === 'go') {
    if (/\bgofmt\b|\bgo fmt\b|\bgofumpt\b|\bgoimports\b/.test(automation)) {
      return pass('Go formatter runs in a task, hook, or CI');
    }
    const golangci = await findConfig(repoPath, [
      '.golangci.yml',
      '.golangci.yaml',
      '.golangci.toml',
    ]);
    // findConfig found it through findFiles, so it is inside the repository.
    const content = golangci
      ? await readTextFile(path.join(repoPath, golangci))
      : null;
    if (content && /\b(gofmt|gofumpt|goimports)\b/.test(content)) {
      return pass(`Go formatter enabled in ${golangci}`, golangci ?? undefined);
    }
    return missing;
  }
  const rustfmt = await findConfig(repoPath, ['rustfmt.toml', '.rustfmt.toml']);
  if (rustfmt) return pass(`rustfmt config found: ${rustfmt}`, rustfmt);
  if (/\bcargo fmt\b|\brustfmt\b/.test(automation)) {
    return pass('rustfmt runs in a task, hook, or CI');
  }
  return missing;
}

/** Fallback when no ecosystem is detected: any supported ecosystem's tool. */
async function anyEcosystem(
  evaluate: (id: EcosystemId) => Promise<SignalEvaluation>,
): Promise<SignalEvaluation> {
  let first: SignalEvaluation | null = null;
  for (const id of ECOSYSTEM_IDS) {
    const evaluation = await evaluate(id);
    if (evaluation.satisfied) return evaluation;
    first ??= evaluation;
  }
  // Unknown stacks report the Node.js wording, as before.
  return first ?? { satisfied: false };
}

function pushResults(
  findings: Finding[],
  results: SignalOutcome['results'],
  kind: 'linter' | 'formatter',
): void {
  for (const { evaluation } of results) {
    findings.push(
      evaluation.satisfied
        ? {
            status: 'pass',
            message: evaluation.passMessage ?? `${kind} configured`,
            ...(evaluation.files ? { files: evaluation.files } : {}),
          }
        : {
            status: 'warn',
            message: evaluation.missingMessage ?? `No ${kind} detected`,
          },
    );
  }
}
