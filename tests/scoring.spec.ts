import { describe, it, expect } from 'vitest';
import {
  sumCategoryScores,
  finalizeAuditResult,
} from '../src/audit/scoring.js';
import type { CategoryResult } from '../src/types.js';

describe('scoring', () => {
  it('sums category scores to total', () => {
    const categories: CategoryResult[] = [
      { id: 'a', label: 'A', score: 20, maxScore: 20, findings: [] },
      { id: 'b', label: 'B', score: 10, maxScore: 15, findings: [] },
    ];
    expect(sumCategoryScores(categories)).toBe(30);
  });

  it('caps total at 100 across all categories', () => {
    const categories: CategoryResult[] = [
      {
        id: 'agent-instructions',
        label: 'Agent',
        score: 25,
        maxScore: 20,
        findings: [],
      },
      {
        id: 'architecture',
        label: 'Arch',
        score: 20,
        maxScore: 15,
        findings: [],
      },
      { id: 'workflow', label: 'Flow', score: 20, maxScore: 15, findings: [] },
      { id: 'testing', label: 'Test', score: 20, maxScore: 15, findings: [] },
      { id: 'safety', label: 'Safety', score: 20, maxScore: 15, findings: [] },
      {
        id: 'navigability',
        label: 'Nav',
        score: 15,
        maxScore: 10,
        findings: [],
      },
      {
        id: 'prompt-assets',
        label: 'Prompts',
        score: 15,
        maxScore: 10,
        findings: [],
      },
    ];
    expect(categories.reduce((sum, c) => sum + c.score, 0)).toBeGreaterThan(
      100,
    );
    expect(sumCategoryScores(categories)).toBe(100);
  });

  it('builds missing AGENTS.md recommendation', () => {
    const categories: CategoryResult[] = [
      {
        id: 'agent-instructions',
        label: 'Agent instructions',
        score: 0,
        maxScore: 20,
        findings: [{ status: 'fail', message: 'AGENTS.md not found' }],
      },
    ];
    const result = finalizeAuditResult('/tmp/repo', categories);
    expect(result.missing).toContain('AGENTS.md');
    expect(result.recommendations.some((r) => r.includes('AGENTS.md'))).toBe(
      true,
    );
  });
});
