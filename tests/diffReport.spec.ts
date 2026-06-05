import { describe, it, expect } from 'vitest';
import { computeDiff, formatDiffReport } from '../src/report/diffReport.js';
import type { AuditJson } from '../src/types.js';

function makeAuditJson(
  score: number,
  catScores: Record<string, number>,
): AuditJson {
  return {
    repoPath: '/tmp/test',
    score,
    categories: Object.entries(catScores).map(([id, s]) => ({
      id,
      label: id,
      score: s,
      maxScore: 20,
      findings: [],
    })),
    missing: [],
    recommendations: [],
  };
}

describe('computeDiff', () => {
  it('computes positive score delta', () => {
    const before = makeAuditJson(60, { 'agent-instructions': 10 });
    const after = makeAuditJson(75, { 'agent-instructions': 20 });
    const diff = computeDiff(before, after);
    expect(diff.scoreDelta).toBe(15);
    expect(diff.categoryDeltas[0].delta).toBe(10);
  });

  it('computes negative score delta', () => {
    const before = makeAuditJson(80, { workflow: 15 });
    const after = makeAuditJson(70, { workflow: 10 });
    const diff = computeDiff(before, after);
    expect(diff.scoreDelta).toBe(-10);
  });

  it('identifies new categories', () => {
    const before = makeAuditJson(60, { 'agent-instructions': 10 });
    const after = makeAuditJson(70, {
      'agent-instructions': 10,
      dependencies: 8,
    });
    const diff = computeDiff(before, after);
    expect(diff.newCategories).toHaveLength(1);
    expect(diff.newCategories[0].id).toBe('dependencies');
  });

  it('identifies removed categories', () => {
    const before = makeAuditJson(70, {
      'agent-instructions': 10,
      'old-check': 5,
    });
    const after = makeAuditJson(60, { 'agent-instructions': 10 });
    const diff = computeDiff(before, after);
    expect(diff.removedCategories).toHaveLength(1);
    expect(diff.removedCategories[0].id).toBe('old-check');
  });
});

describe('formatDiffReport', () => {
  it('shows no-change messaging for zero deltas', () => {
    const score = 60;
    const before = makeAuditJson(score, { 'agent-instructions': 10 });
    const after = makeAuditJson(score, { 'agent-instructions': 10 });
    const diff = computeDiff(before, after);
    const output = formatDiffReport(diff);
    expect(output).toContain('no change');
  });

  it('lists new and removed categories', () => {
    const before = makeAuditJson(60, { 'agent-instructions': 10 });
    const after = makeAuditJson(70, {
      'agent-instructions': 10,
      dependencies: 8,
    });
    const diff = computeDiff(before, after);
    const output = formatDiffReport(diff);
    expect(output).toContain('New categories');
    expect(output).toContain('dependencies');
  });

  it('includes after recommendations when present', () => {
    const before = makeAuditJson(60, { 'agent-instructions': 10 });
    const after = {
      ...makeAuditJson(65, { 'agent-instructions': 15 }),
      recommendations: ['Add CLAUDE.md'],
    };
    const output = formatDiffReport(computeDiff(before, after));
    expect(output).toContain('Current recommendations');
    expect(output).toContain('Add CLAUDE.md');
  });

  it('produces output with score values', () => {
    const before = makeAuditJson(60, { 'agent-instructions': 10 });
    const after = makeAuditJson(75, { 'agent-instructions': 20 });
    const diff = computeDiff(before, after);
    const output = formatDiffReport(diff);
    expect(output).toContain('60');
    expect(output).toContain('75');
  });
});
