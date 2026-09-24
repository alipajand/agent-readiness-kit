import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { readTextFile } from '../fs/readTextFile.js';
import { isRealpathWithin } from '../fs/safePath.js';
import { writeFileNoFollow } from '../fs/writeFileSafe.js';
import type { AuditResult } from '../types.js';

const HISTORY_FILE = '.ark-history.json';
const MAX_HISTORY_ENTRIES = 20;

export type HistoryEntry = {
  timestamp: string;
  score: number;
  categories: Array<{
    id: string;
    label: string;
    score: number;
    maxScore: number;
  }>;
};

export type AuditHistory = {
  entries: HistoryEntry[];
};

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.timestamp === 'string' &&
    typeof entry.score === 'number' &&
    Number.isFinite(entry.score) &&
    Array.isArray(entry.categories)
  );
}

/**
 * Read `.ark-history.json`. The file comes from the audited repository, so
 * anything that is not a list of well-formed entries is treated as empty
 * instead of crashing the audit.
 */
export async function loadHistory(repoPath: string): Promise<AuditHistory> {
  const raw = await readTextFile(path.join(repoPath, HISTORY_FILE));
  if (raw === null) return { entries: [] };
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown } | null;
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return { entries: entries.filter(isHistoryEntry) };
  } catch {
    return { entries: [] };
  }
}

export async function appendHistory(
  repoPath: string,
  result: AuditResult,
): Promise<HistoryEntry> {
  const history = await loadHistory(repoPath);
  const entry: HistoryEntry = {
    timestamp: new Date().toISOString(),
    score: result.score,
    categories: result.categories.map((c) => ({
      id: c.id,
      label: c.label,
      score: c.score,
      maxScore: c.maxScore,
    })),
  };
  history.entries.push(entry);
  if (history.entries.length > MAX_HISTORY_ENTRIES) {
    history.entries = history.entries.slice(-MAX_HISTORY_ENTRIES);
  }
  const filePath = path.join(repoPath, HISTORY_FILE);
  // `ark audit` writes history by default, so a repository must not be able
  // to redirect it: never through a symlink, never outside the repository.
  const existing = await lstat(filePath).catch(() => null);
  if (existing?.isSymbolicLink() || !isRealpathWithin(repoPath, filePath)) {
    throw new HistoryWriteError(
      `Refusing to write ${HISTORY_FILE}: it is a symbolic link or resolves outside ${repoPath}. Use --no-history to skip it.`,
    );
  }
  await writeFileNoFollow(filePath, JSON.stringify(history, null, 2));
  return entry;
}

export class HistoryWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoryWriteError';
  }
}

export function getScoreDelta(
  history: AuditHistory,
  currentScore: number,
): number | null {
  if (history.entries.length === 0) return null;
  const last = history.entries[history.entries.length - 1];
  return currentScore - last.score;
}
