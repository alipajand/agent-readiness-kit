import path from 'node:path';
import { isRealpathWithin, isWithin } from './safePath.js';

export class OutputPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputPathError';
  }
}

export type ResolveOutputPathOptions = {
  /** Permit the resolved path to land outside the repository root. */
  allowOutside?: boolean;
};

/**
 * True when `target` is a descendant of `root`, both lexically and after
 * resolving symlinks in the part of the path that already exists, so a
 * symlinked directory inside the repo cannot redirect the write elsewhere.
 */
function isInsideRepo(root: string, target: string): boolean {
  return (
    target !== root && isWithin(root, target) && isRealpathWithin(root, target)
  );
}

/**
 * Resolve a user-supplied `--output` path against the audited repository root.
 *
 * Relative paths are resolved under `repoPath`; absolute paths are used as given.
 * Either way the result must stay inside the repository unless `allowOutside` is
 * set, so `../` segments, absolute paths, and symlinked directories cannot
 * silently overwrite files elsewhere on the machine.
 */
export function resolveOutputPath(
  repoPath: string,
  output: string,
  options: ResolveOutputPathOptions = {},
): string {
  const root = path.resolve(repoPath);
  const resolved = path.resolve(root, output);

  if (options.allowOutside || isInsideRepo(root, resolved)) {
    return resolved;
  }

  throw new OutputPathError(
    `--output must resolve to a path inside the audited repository.\n` +
      `  given:    ${output}\n` +
      `  resolved: ${resolved}\n` +
      `  repo:     ${root}\n` +
      `Pass --allow-outside to write outside the repository.`,
  );
}
