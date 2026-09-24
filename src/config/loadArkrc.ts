import { readFile, stat } from 'node:fs/promises';
import { MAX_TEXT_FILE_BYTES } from '../fs/readTextFile.js';
import path from 'node:path';
import { arkrcSchema, type ArkRc } from './schema.js';
import { fileExists } from '../fs/fileExists.js';
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
  if (!(await fileExists(filePath))) {
    return null;
  }

  const info = await stat(filePath);
  if (!info.isFile() || info.size > MAX_TEXT_FILE_BYTES) {
    throw new ArkrcError(
      `${ARKRC_FILENAME} at ${filePath} must be a regular file under ${MAX_TEXT_FILE_BYTES} bytes`,
    );
  }

  let raw: unknown;
  try {
    const text = await readFile(filePath, 'utf8');
    raw = JSON.parse(text) as unknown;
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
