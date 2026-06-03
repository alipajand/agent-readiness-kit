import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { arkrcSchema, type ArkRc } from './schema.js';
import { fileExists } from '../fs/fileExists.js';

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

  return parsed.data;
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
  cli: { json?: boolean; output?: string },
  arkrc: ArkRc | null,
): { repoPathArg: string; json: boolean; output?: string } {
  const audit = arkrc?.audit;
  return {
    repoPathArg: resolveRepoArg(repoArg, audit?.repoPath),
    json: cli.json ?? audit?.json ?? false,
    output: cli.output ?? audit?.output,
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
