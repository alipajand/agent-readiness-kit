import path from 'node:path';
import { fileExists, dirExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import { readTextFile } from '../../fs/readTextFile.js';
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
  readRoot,
  readRootJson,
  repoFileExists,
  tomlTables,
} from '../projectFiles.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 10;
const LOCKFILE_POINTS = 3;
const VERSION_PIN_POINTS = 2;

type PackageJson = {
  engines?: Record<string, string>;
};

const NODE_LOCKFILES = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
];
const PYTHON_LOCKFILES = [
  'uv.lock',
  'poetry.lock',
  'Pipfile.lock',
  'pdm.lock',
  'pylock.toml',
  'pylock.*.toml',
];

const LOCKFILE_MISSING: Record<EcosystemId, string> = {
  node: 'No lockfile found (pnpm-lock.yaml / package-lock.json / yarn.lock)',
  python:
    'No Python lockfile found (uv.lock / poetry.lock / Pipfile.lock / pdm.lock, or fully pinned requirements.txt)',
  go: 'No go.sum found for a go.mod that declares dependencies',
  rust: 'No Cargo.lock found',
};

const VERSION_PIN_MISSING: Record<EcosystemId, string> = {
  node: 'No Node.js version pin (.nvmrc, .node-version, or engines in package.json)',
  python:
    'No Python version pin (.python-version or requires-python in pyproject.toml)',
  go: 'No Go version declared (go directive in go.mod or .go-version)',
  rust: 'No Rust toolchain pin (rust-toolchain.toml or rust-version in Cargo.toml)',
};

export async function checkDependencies(
  repoPath: string,
  detected?: DetectedEcosystems,
): Promise<CategoryResult> {
  const ecosystems = detected ?? (await detectEcosystems(repoPath));
  const findings: Finding[] = [];
  let score = 0;

  // Lockfile per ecosystem
  const lockfiles = await scoreEcosystemSignal(
    ecosystems,
    LOCKFILE_POINTS,
    (id) => evaluateLockfile(repoPath, ecosystems, id),
    () =>
      anyEcosystem(
        (id) => evaluateLockfile(repoPath, ecosystems, id),
        'No dependency manifest or lockfile found',
      ),
  );
  score += lockfiles.points;
  pushOutcome(findings, lockfiles, 'fail');

  // Runtime / toolchain version pin per ecosystem
  const pins = await scoreEcosystemSignal(
    ecosystems,
    VERSION_PIN_POINTS,
    (id) => evaluateVersionPin(repoPath, ecosystems, id),
    () =>
      anyEcosystem(
        (id) => evaluateVersionPin(repoPath, ecosystems, id),
        'No runtime or toolchain version pin found',
      ),
  );
  score += pins.points;
  pushOutcome(findings, pins, 'warn');

  // Dependabot or Renovate
  const depbotPaths = ['.github/dependabot.yml', '.github/dependabot.yaml'];
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
      message:
        'No automated dependency update config (dependabot.yml or renovate.json)',
    });
  }

  // Package manager / registry config
  const pyproject = await readRoot(repoPath, 'pyproject.toml');
  const pyTables = pyproject ? tomlTables(pyproject) : null;
  const registryFiles = [
    '.npmrc',
    '.pnpmfile.cjs',
    'uv.toml',
    'pip.conf',
    '.cargo/config.toml',
    '.cargo/config',
  ];
  let registry: string | null = null;
  for (const rel of registryFiles) {
    if (await repoFileExists(repoPath, rel)) {
      registry = rel;
      break;
    }
  }
  if (!registry && pyTables && hasTomlTable(pyTables, 'tool.uv')) {
    registry = 'pyproject.toml [tool.uv]';
  }
  if (registry) {
    score += 1;
    findings.push({
      status: 'pass',
      message: `Package manager config: ${registry}`,
      files: [registry.split(' ')[0]],
    });
  }

  // Workspace config
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
  } else {
    const other = await findWorkspaceConfig(repoPath);
    if (other) {
      score += 1;
      findings.push({
        status: 'pass',
        message: `Workspace config: ${other}`,
        files: [other.split(' ')[0]],
      });
    }
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

/** go.work, a Cargo `[workspace]`, or a uv workspace. */
export async function findWorkspaceConfig(
  repoPath: string,
): Promise<string | null> {
  if (await repoFileExists(repoPath, 'go.work')) return 'go.work';
  const cargo = await readRoot(repoPath, 'Cargo.toml');
  if (cargo && hasTomlTable(tomlTables(cargo), 'workspace')) {
    return 'Cargo.toml [workspace]';
  }
  const pyproject = await readRoot(repoPath, 'pyproject.toml');
  if (pyproject && hasTomlTable(tomlTables(pyproject), 'tool.uv.workspace')) {
    return 'pyproject.toml [tool.uv.workspace]';
  }
  return null;
}

function pushOutcome(
  findings: Finding[],
  outcome: SignalOutcome,
  missingStatus: 'warn' | 'fail',
): void {
  for (const { evaluation } of outcome.results) {
    if (evaluation.satisfied) {
      findings.push({
        status: 'pass',
        message: evaluation.passMessage ?? 'Present',
        ...(evaluation.files ? { files: evaluation.files } : {}),
      });
    } else {
      findings.push({
        status: missingStatus,
        message: evaluation.missingMessage ?? 'Missing',
      });
    }
  }
}

/** Fallback when no ecosystem is detected: any supported ecosystem's evidence. */
async function anyEcosystem(
  evaluate: (id: EcosystemId) => Promise<SignalEvaluation>,
  missingMessage: string,
): Promise<SignalEvaluation> {
  for (const id of ECOSYSTEM_IDS) {
    const evaluation = await evaluate(id);
    if (evaluation.satisfied) return evaluation;
  }
  return { satisfied: false, missingMessage };
}

async function evaluateLockfile(
  repoPath: string,
  ecosystems: DetectedEcosystems,
  id: EcosystemId,
): Promise<SignalEvaluation> {
  const found = (files: string[], label = files[0]): SignalEvaluation => ({
    satisfied: true,
    passMessage: `Lockfile present: ${label}`,
    files: files.slice(0, 5),
  });
  const missing = { satisfied: false, missingMessage: LOCKFILE_MISSING[id] };

  if (id === 'node') {
    // Root lockfiles first, in the original order, then nested ones.
    for (const rel of NODE_LOCKFILES) {
      if (await repoFileExists(repoPath, rel)) return found([rel]);
    }
    const nested = await findInRepo(
      repoPath,
      NODE_LOCKFILES.map((f) => `**/${f}`),
    );
    return nested.length > 0 ? found(nested) : missing;
  }

  if (id === 'python') {
    const locks = await findInRepo(
      repoPath,
      PYTHON_LOCKFILES.map((f) => `**/${f}`),
    );
    if (locks.length > 0) return found(locks);
    const requirements = await findInRepo(repoPath, [
      'requirements*.txt',
      'requirements/*.txt',
    ]);
    const pinned: string[] = [];
    for (const rel of requirements) {
      const content = await readTextFile(path.join(repoPath, rel));
      if (content !== null && requirementsArePinned(content)) pinned.push(rel);
    }
    return pinned.length > 0
      ? found(pinned, `${pinned[0]} (all requirements pinned)`)
      : missing;
  }

  if (id === 'go') {
    const sums = await findInRepo(repoPath, '**/go.sum');
    if (sums.length > 0) return found(sums);
    const mods = ecosystems.manifests.go ?? [];
    for (const rel of mods) {
      const content = await readTextFile(path.join(repoPath, rel));
      if (content === null || goModRequires(content)) return missing;
    }
    // A module with no requirements has nothing to lock; go.sum is not created.
    return mods.length > 0
      ? {
          satisfied: true,
          passMessage: 'go.mod declares no dependencies (nothing to lock)',
          files: mods.slice(0, 5),
        }
      : missing;
  }

  const cargoLocks = await findInRepo(repoPath, '**/Cargo.lock');
  return cargoLocks.length > 0 ? found(cargoLocks) : missing;
}

/** True when every requirement line pins an exact version (`==` or `===`). */
export function requirementsArePinned(content: string): boolean {
  let requirements = 0;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.replace(/\s#[\s\S]*/, '').trim();
    if (line === '' || line.startsWith('#') || line.startsWith('-')) continue;
    requirements += 1;
    if (!/[^=!<>~]==={0,1}[^=]/.test(line)) return false;
  }
  return requirements > 0;
}

/** True when go.mod has a `require` directive. */
export function goModRequires(content: string): boolean {
  return /^[ \t]*require\b/m.test(content);
}

async function evaluateVersionPin(
  repoPath: string,
  ecosystems: DetectedEcosystems,
  id: EcosystemId,
): Promise<SignalEvaluation> {
  const pass = (message: string, file: string): SignalEvaluation => ({
    satisfied: true,
    passMessage: message,
    files: [file],
  });
  const missing = { satisfied: false, missingMessage: VERSION_PIN_MISSING[id] };
  const toolVersions = await readRoot(repoPath, '.tool-versions');
  const toolPinned = (names: string[]) =>
    toolVersions !== null &&
    toolVersions
      .split(/\r?\n/)
      .some((l) => names.includes(l.trim().split(/\s+/)[0] ?? ''));

  if (id === 'node') {
    for (const rel of ['.nvmrc', '.node-version']) {
      if (await repoFileExists(repoPath, rel)) {
        return pass(`Node version pinned: ${rel}`, rel);
      }
    }
    if (toolPinned(['nodejs', 'node'])) {
      return pass('Node version pinned: .tool-versions', '.tool-versions');
    }
    const pkg = await readRootJson<PackageJson>(repoPath, 'package.json');
    if (pkg?.engines && Object.keys(pkg.engines).length > 0) {
      return pass(
        'Node version constrained via package.json engines field',
        'package.json',
      );
    }
    const nested = await findInRepo(repoPath, [
      '**/.nvmrc',
      '**/.node-version',
    ]);
    if (nested.length > 0) {
      return pass(`Node version pinned: ${nested[0]}`, nested[0]);
    }
    return missing;
  }

  if (id === 'python') {
    const files = await findInRepo(repoPath, '**/.python-version');
    if (files.length > 0) {
      return pass(`Python version pinned: ${files[0]}`, files[0]);
    }
    if (toolPinned(['python'])) {
      return pass('Python version pinned: .tool-versions', '.tool-versions');
    }
    for (const rel of ecosystems.manifests.python ?? []) {
      if (!rel.endsWith('pyproject.toml') && !rel.endsWith('Pipfile')) continue;
      const content = await readTextFile(path.join(repoPath, rel));
      if (
        content &&
        /^[ \t]*(requires-python|python_version)[ \t]*=/m.test(content)
      ) {
        return pass(`Python version constrained via ${rel}`, rel);
      }
    }
    return missing;
  }

  if (id === 'go') {
    for (const rel of ecosystems.manifests.go ?? []) {
      const content = await readTextFile(path.join(repoPath, rel));
      if (content && /^[ \t]*(go|toolchain)[ \t]+\S/m.test(content)) {
        return pass(`Go version declared in ${rel}`, rel);
      }
    }
    if (await repoFileExists(repoPath, '.go-version')) {
      return pass('Go version pinned: .go-version', '.go-version');
    }
    if (toolPinned(['golang', 'go'])) {
      return pass('Go version pinned: .tool-versions', '.tool-versions');
    }
    return missing;
  }

  const toolchain = await findInRepo(repoPath, [
    'rust-toolchain.toml',
    'rust-toolchain',
  ]);
  if (toolchain.length > 0) {
    return pass(`Rust toolchain pinned: ${toolchain[0]}`, toolchain[0]);
  }
  for (const rel of ecosystems.manifests.rust ?? []) {
    const content = await readTextFile(path.join(repoPath, rel));
    if (content && /^[ \t]*rust-version[ \t]*=/m.test(content)) {
      return pass(`Rust version constrained via ${rel}`, rel);
    }
  }
  if (toolPinned(['rust'])) {
    return pass('Rust version pinned: .tool-versions', '.tool-versions');
  }
  return missing;
}
