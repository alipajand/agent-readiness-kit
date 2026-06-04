import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  appendHistory,
  loadHistory,
  getScoreDelta,
} from '../src/audit/history.js';
import type { AuditResult } from '../src/types.js';

function makeResult(score: number): AuditResult {
  return {
    repoPath: '/tmp/test',
    score,
    categories: [
      { id: 'agent-instructions', label: 'Agent instructions', score, maxScore: 20, findings: [] },
    ],
    missing: [],
    recommendations: [],
  };
}

describe('history', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-hist-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('returns empty history when no file exists', async () => {
    const h = await loadHistory(repoPath);
    expect(h.entries).toHaveLength(0);
  });

  it('appends an entry and persists it', async () => {
    await appendHistory(repoPath, makeResult(72));
    const h = await loadHistory(repoPath);
    expect(h.entries).toHaveLength(1);
    expect(h.entries[0].score).toBe(72);
  });

  it('accumulates multiple entries', async () => {
    await appendHistory(repoPath, makeResult(60));
    await appendHistory(repoPath, makeResult(75));
    const h = await loadHistory(repoPath);
    expect(h.entries).toHaveLength(2);
  });

  it('caps entries at 20', async () => {
    for (let i = 0; i < 25; i++) {
      await appendHistory(repoPath, makeResult(i));
    }
    const h = await loadHistory(repoPath);
    expect(h.entries.length).toBeLessThanOrEqual(20);
  });

  it('getScoreDelta returns null for empty history', () => {
    expect(getScoreDelta({ entries: [] }, 80)).toBeNull();
  });

  it('getScoreDelta returns correct positive delta', async () => {
    await appendHistory(repoPath, makeResult(60));
    const h = await loadHistory(repoPath);
    expect(getScoreDelta(h, 75)).toBe(15);
  });

  it('getScoreDelta returns negative delta when score drops', async () => {
    await appendHistory(repoPath, makeResult(80));
    const h = await loadHistory(repoPath);
    expect(getScoreDelta(h, 70)).toBe(-10);
  });
});
