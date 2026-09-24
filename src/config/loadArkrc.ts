import { MAX_TEXT_FILE_BYTES, readRegularFile } from '../fs/readTextFile.js';
import path from 'node:path';
import { arkrcSchema, type ArkRc } from './schema.js';
import { isWithin } from '../fs/safePath.js';

const ARKRC_FILENAME = '.arkrc';

export class ArkrcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArkrcError';
  }
}

export function formatArkrcValidationError(
  repoPath: string,
  issues: string,
): string {
  return `Invalid ${ARKRC_FILENAME} in ${repoPath}: ${issues}`;
}

export async function loadArkrc(repoPath: string): Promise<ArkRc | null> {
  const filePath = path.join(path.resolve(repoPath), ARKRC_FILENAME);
  const read = await readRegularFile(filePath, MAX_TEXT_FILE_BYTES);
  if (read.status === 'missing') {
    return null;
  }
  if (read.status === 'not-a-file' || read.status === 'too-large') {
    throw new ArkrcError(
      `${ARKRC_FILENAME} at ${filePath} must be a regular file under ${MAX_TEXT_FILE_BYTES} bytes`,
    );
  }

  let raw: unknown;
  try {
    if (read.status === 'error') throw read.error;
    raw = JSON.parse(read.content) as unknown;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ArkrcError(
      `Failed to parse ${ARKRC_FILENAME} at ${filePath}: ${detail}`,
    );
  }

  const parsed = arkrcSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ArkrcError(formatArkrcValidationError(repoPath, issues));
  }

  assertConfigPathsInside(path.resolve(repoPath), parsed.data);
  return parsed.data;
}

/**
 * `.arkrc` comes from the repository itself, so its paths must not point
 * elsewhere: `init`/`generate` would otherwise scaffold (or, with `force`,
 * overwrite) files in another directory, and `audit` would write its report
 * and history there.
 */
function assertConfigPathsInside(root: string, config: ArkRc): void {
  const paths: Array<[string, string | undefined]> = [
    ['audit.repoPath', config.audit?.repoPath],
    ['init.repoPath', config.init?.repoPath],
    ['generate.repoPath', config.generate?.repoPath],
  ];
  for (const [key, value] of paths) {
    if (value !== undefined && !isWithin(root, path.resolve(root, value))) {
      throw new ArkrcError(
        formatArkrcValidationError(root, `${key}: must stay inside ${root}`),
      );
    }
  }

  const output = config.audit?.output;
  if (output !== undefined) {
    const auditRoot = path.resolve(root, config.audit?.repoPath ?? '.');
    const target = path.resolve(auditRoot, output);
    if (target === auditRoot || !isWithin(auditRoot, target)) {
      throw new ArkrcError(
        formatArkrcValidationError(
          root,
          `audit.output: must stay inside ${auditRoot}`,
        ),
      );
    }
  }
}

export function resolveRepoArg(
  repoArg: string,
  configRepoPath?: string,
): string {
  if (repoArg !== '.') {
    return repoArg;
  }
  return configRepoPath ?? '.';
}

export function resolveAuditRunOptions(
  repoArg: string,
  cli: { json?: boolean; output?: string; minScore?: number },
  arkrc: ArkRc | null,
): { repoPathArg: string; json: boolean; output?: string; minScore?: number } {
  const audit = arkrc?.audit;
  return {
    repoPathArg: resolveRepoArg(repoArg, audit?.repoPath),
    json: cli.json ?? audit?.json ?? false,
    output: cli.output ?? audit?.output,
    minScore: cli.minScore ?? audit?.minScore,
  };
}

export function resolveInitOptions(
  repoArg: string,
  cli: { force?: boolean },
  arkrc: ArkRc | null,
): { repoPathArg: string; force: boolean } {
  const init = arkrc?.init;
  return {
    repoPathArg: resolveRepoArg(repoArg, init?.repoPath),
    force: cli.force ?? init?.force ?? false,
  };
}

export function resolveGenerateOptions(
  repoArg: string,
  cli: { force?: boolean },
  arkrc: ArkRc | null,
): { repoPathArg: string; force: boolean } {
  const generate = arkrc?.generate;
  return {
    repoPathArg: resolveRepoArg(repoArg, generate?.repoPath),
    force: cli.force ?? generate?.force ?? false,
  };
}
