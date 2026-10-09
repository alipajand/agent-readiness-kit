import path from 'node:path';
import { findFiles } from '../fs/findFiles.js';
import { TEST_SCAN_IGNORE } from './testFiles.js';

/**
 * Ecosystems whose project files the audit understands. Checks that look for
 * ecosystem-specific files (lockfiles, version pins, test runners, linters,
 * formatters) evaluate each detected ecosystem against its own equivalents.
 */
export const ECOSYSTEM_IDS = ['node', 'python', 'go', 'rust'] as const;

export type EcosystemId = (typeof ECOSYSTEM_IDS)[number];

export const ECOSYSTEM_LABELS: Record<EcosystemId, string> = {
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
};

export type DetectedEcosystems = {
  /** Detected ecosystems in `ECOSYSTEM_IDS` order. Empty when none matched. */
  ids: EcosystemId[];
  /** Manifest paths relative to the repository, per detected ecosystem. */
  manifests: Partial<Record<EcosystemId, string[]>>;
};

/**
 * Manifests are looked for this many directory levels deep, so a Python API
 * with a `frontend/package.json` or `apps/web/package.json` is seen as both.
 */
export const MANIFEST_SCAN_DEPTH = 4;

/** Directories whose manifests do not describe the repository itself. */
export const ECOSYSTEM_SCAN_IGNORE = [
  ...TEST_SCAN_IGNORE,
  '**/examples/**',
  '**/example/**',
];

const MANIFESTS: Record<EcosystemId, { anyDepth: string[]; root: string[] }> = {
  node: {
    anyDepth: ['package.json'],
    root: [
      'pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      'bun.lock',
      'bun.lockb',
    ],
  },
  python: {
    anyDepth: ['pyproject.toml', 'setup.py', 'Pipfile'],
    // A nested requirements.txt is usually a docs or tooling helper (for
    // example docs/requirements.txt for Read the Docs), so only the root counts.
    root: ['requirements.txt', 'requirements-*.txt', 'requirements/*.txt'],
  },
  go: { anyDepth: ['go.mod'], root: [] },
  rust: { anyDepth: ['Cargo.toml'], root: [] },
};

export async function detectEcosystems(
  repoPath: string,
): Promise<DetectedEcosystems> {
  const ids: EcosystemId[] = [];
  const manifests: Partial<Record<EcosystemId, string[]>> = {};

  for (const id of ECOSYSTEM_IDS) {
    const { anyDepth, root } = MANIFESTS[id];
    const found = [
      ...(await findInRepo(
        repoPath,
        anyDepth.map((name) => `**/${name}`),
      )),
      ...(root.length > 0 ? await findInRepo(repoPath, root) : []),
    ];
    if (found.length > 0) {
      ids.push(id);
      manifests[id] = [...new Set(found)].sort();
    }
  }

  return { ids, manifests };
}

/**
 * Glob within the manifest scan depth, skipping dependency, build, fixture,
 * and example directories. Returns repository-relative POSIX paths, sorted.
 */
export async function findInRepo(
  repoPath: string,
  patterns: string | string[],
): Promise<string[]> {
  const files = await findFiles(repoPath, patterns, {
    ignore: ECOSYSTEM_SCAN_IGNORE,
    deep: MANIFEST_SCAN_DEPTH,
  });
  return files.map((f) => path.relative(repoPath, f).split(path.sep).join('/'));
}

/**
 * Display text for a result's `ecosystems` field: labels for known ids, raw
 * ids otherwise (results loaded from JSON can hold anything), or
 * `none detected`. Callers escape the text for their output format.
 */
export function describeEcosystems(ids: readonly string[]): string {
  if (ids.length === 0) return 'none detected';
  return ids
    .map((id) =>
      Object.hasOwn(ECOSYSTEM_LABELS, id)
        ? ECOSYSTEM_LABELS[id as EcosystemId]
        : id,
    )
    .join(', ');
}

/**
 * Result of evaluating one ecosystem-specific signal for one ecosystem.
 * `files` is the evidence when satisfied.
 */
export type SignalEvaluation = {
  satisfied: boolean;
  passMessage?: string;
  missingMessage?: string;
  files?: string[];
};

export type SignalOutcome = {
  points: number;
  satisfied: number;
  applicable: number;
  /** Per-ecosystem results, in detection order. */
  results: Array<{ id: EcosystemId | null; evaluation: SignalEvaluation }>;
};

/**
 * Score one ecosystem-specific signal worth `maxPoints`.
 *
 * - With detected ecosystems, each one is evaluated on its own files and the
 *   signal earns `floor(maxPoints * satisfied / detected)`. A polyglot
 *   repository is scored on every stack it contains.
 * - With no detected ecosystem, `fallback` looks for the evidence of any
 *   supported ecosystem and the signal earns full points only when that
 *   evidence exists. Nothing is awarded for a check that does not apply.
 */
export async function scoreEcosystemSignal(
  detected: DetectedEcosystems,
  maxPoints: number,
  evaluate: (id: EcosystemId) => Promise<SignalEvaluation>,
  fallback: () => Promise<SignalEvaluation>,
): Promise<SignalOutcome> {
  if (detected.ids.length === 0) {
    const evaluation = await fallback();
    return {
      points: evaluation.satisfied ? maxPoints : 0,
      satisfied: evaluation.satisfied ? 1 : 0,
      applicable: 1,
      results: [{ id: null, evaluation }],
    };
  }

  const results: SignalOutcome['results'] = [];
  for (const id of detected.ids) {
    results.push({ id, evaluation: await evaluate(id) });
  }
  const satisfied = results.filter((r) => r.evaluation.satisfied).length;
  return {
    points: proportionalPoints(maxPoints, satisfied, detected.ids.length),
    satisfied,
    applicable: detected.ids.length,
    results,
  };
}

/** `floor(maxPoints * satisfied / applicable)`, or 0 when nothing applies. */
export function proportionalPoints(
  maxPoints: number,
  satisfied: number,
  applicable: number,
): number {
  if (applicable <= 0) return 0;
  return Math.floor((maxPoints * satisfied) / applicable);
}
