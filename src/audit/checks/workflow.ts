import { detectEcosystems, type DetectedEcosystems } from '../ecosystems.js';
import {
  isPackageJsonSource,
  readTaskSources,
  type TaskSource,
} from '../projectFiles.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 15;

const ALL_SCRIPTS = [
  'dev',
  'build',
  'lint',
  'test',
  'typecheck',
  'format',
  'clean',
] as const;

type Role = (typeof ALL_SCRIPTS)[number];

const SCRIPT_POINTS: Record<Role, number> = {
  dev: 2,
  build: 3,
  lint: 2,
  test: 3,
  typecheck: 3,
  format: 1,
  clean: 1,
};

/**
 * Names that fill each role in task runners other than package.json. npm
 * scripts keep their exact names, as before. `test`, `lint`, `typecheck`,
 * `build`, and `format` also match prefixed names such as `test-unit`.
 */
const ROLE_ALIASES: Record<Role, string[]> = {
  dev: ['dev', 'run', 'serve', 'start', 'watch'],
  build: ['build', 'compile'],
  lint: ['lint', 'vet', 'clippy'],
  test: ['test', 'tests'],
  typecheck: ['typecheck', 'type-check', 'types', 'mypy', 'pyright'],
  format: ['format', 'fmt'],
  clean: ['clean'],
};

const PREFIX_ROLES = new Set<Role>([
  'build',
  'lint',
  'test',
  'typecheck',
  'format',
]);

/** Ecosystems whose compiler type-checks during a build. */
const COMPILED = new Set(['go', 'rust']);

export const TASK_RUNNER_LIST =
  'package.json scripts, Makefile, justfile, Taskfile, pyproject.toml tasks, tox.ini, or noxfile.py';

export function commandFillsRole(
  source: string,
  name: string,
  role: Role,
): boolean {
  if (isPackageJsonSource(source)) return name === role;
  const lower = name.toLowerCase();
  return ROLE_ALIASES[role].some(
    (alias) =>
      lower === alias ||
      (PREFIX_ROLES.has(role) &&
        (lower.startsWith(`${alias}-`) ||
          lower.startsWith(`${alias}_`) ||
          lower.startsWith(`${alias}:`))),
  );
}

/** First source and command name that fills `role`, if any. */
export function findRoleCommand(
  sources: TaskSource[],
  role: Role,
): { source: string; name: string } | null {
  for (const { source, names } of sources) {
    const name = names.find((n) => commandFillsRole(source, n, role));
    if (name !== undefined) return { source, name };
  }
  return null;
}

export async function checkWorkflow(
  repoPath: string,
  detected?: DetectedEcosystems,
): Promise<CategoryResult> {
  const ecosystems = detected ?? (await detectEcosystems(repoPath));
  const sources = await readTaskSources(
    repoPath,
    ecosystems.manifests.node ?? [],
  );
  const npmOnly = sources.every((s) => s.source === 'package.json');

  if (sources.length === 0) {
    const message =
      ecosystems.ids.length === 1 && ecosystems.ids[0] === 'node'
        ? 'No package.json scripts found'
        : `No task runner commands found (${TASK_RUNNER_LIST})`;
    return result(0, [{ status: 'fail', message }]);
  }

  const found = new Map<Role, { source: string; name: string }>();
  for (const role of ALL_SCRIPTS) {
    const hit = findRoleCommand(sources, role);
    if (hit) found.set(role, hit);
  }

  const findings: Finding[] = [];
  const present = ALL_SCRIPTS.filter((r) => found.has(r));
  if (npmOnly) {
    findings.push({
      status: 'pass',
      message: `Scripts present: ${present.join(', ') || 'none'}`,
      files: present.map((s) => `package.json#scripts.${s}`),
    });
  } else {
    findings.push({
      status: 'pass',
      message: `Commands present: ${
        present.map((r) => `${r} (${found.get(r)?.source})`).join(', ') ||
        'none'
      }`,
      files: present.map((r) => {
        const hit = found.get(r);
        return hit && isPackageJsonSource(hit.source)
          ? `${hit.source}#scripts.${hit.name}`
          : `${hit?.source}#${hit?.name}`;
      }),
    });
  }

  // Go and Rust compile with type checking, so a build command covers it.
  const compiledOnly =
    ecosystems.ids.length > 0 && ecosystems.ids.every((id) => COMPILED.has(id));
  let typecheckViaBuild = false;
  if (!found.has('typecheck') && found.has('build') && compiledOnly) {
    typecheckViaBuild = true;
    findings.push({
      status: 'pass',
      message: `Type checking runs in the build command (${found.get('build')?.source})`,
    });
  }

  let score = 0;
  for (const role of ALL_SCRIPTS) {
    if (found.has(role) || (role === 'typecheck' && typecheckViaBuild)) {
      score += SCRIPT_POINTS[role];
    }
  }
  score = Math.min(MAX_SCORE, score);

  const noun = npmOnly ? 'script' : 'command';
  if (!found.has('test')) {
    findings.push({
      status: 'fail',
      message: `Missing test ${noun} — agents need a clear test command`,
    });
  }
  if (!found.has('typecheck') && !typecheckViaBuild) {
    findings.push({
      status: 'warn',
      message: `Missing typecheck ${noun} — recommend adding explicit typecheck`,
    });
  }
  for (const name of ['dev', 'build', 'lint'] as const) {
    if (!found.has(name)) {
      findings.push({ status: 'warn', message: `Missing ${noun}: ${name}` });
    }
  }

  return result(score, findings);
}

function result(score: number, findings: Finding[]): CategoryResult {
  return {
    id: 'workflow',
    label: 'Developer workflow clarity',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
