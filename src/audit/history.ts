import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { AuditResult } from '../types.js';

const HISTORY_FILE = '.ark-history.json';
const MAX_HISTORY_ENTRIES = 20;

export type HistoryEntry = {
  timestamp: string;
  score: number;
  categories: Array<{ id: string; label: string; score: number; maxScore: number }>;
};

export type AuditHistory = {
  entries: HistoryEntry[];
};

export async function loadHistory(repoPath: string): Promise<AuditHistory> {
  const filePath = path.join(repoPath, HISTORY_FILE);
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as AuditHistory;
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
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');
  return entry;
}

export function getScoreDelta(
  history: AuditHistory,
  currentScore: number,
): number | null {
  if (history.entries.length === 0) return null;
  const last = history.entries[history.entries.length - 1];
  return currentScore - last.score;
}
