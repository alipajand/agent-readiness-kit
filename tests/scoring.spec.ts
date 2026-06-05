import { describe, it, expect } from 'vitest';
import {
  sumCategoryScores,
  finalizeAuditResult,
  buildMissingAndRecommendations,
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

  it('builds architecture and env recommendations from failures', () => {
    const categories: CategoryResult[] = [
      {
        id: 'architecture',
        label: 'Architecture',
        score: 0,
        maxScore: 15,
        findings: [
          {
            status: 'fail',
            message:
              'No architecture doc or ADR directory (required for >10 points)',
          },
        ],
      },
      {
        id: 'safety',
        label: 'Safety',
        score: 0,
        maxScore: 15,
        findings: [{ status: 'fail', message: '.env.example not found' }],
      },
    ];
    const { missing, recommendations } = buildMissingAndRecommendations(
      categories,
      '/tmp/repo',
    );
    expect(missing).toContain('docs/ARCHITECTURE.md');
    expect(missing).toContain('.env.example');
    expect(recommendations.some((r) => r.includes('ARCHITECTURE'))).toBe(true);
    expect(recommendations.some((r) => r.includes('.env.example'))).toBe(true);
  });

  it('adds prompt-assets recommendation when score is low', () => {
    const categories: CategoryResult[] = [
      {
        id: 'prompt-assets',
        label: 'Prompt assets',
        score: 0,
        maxScore: 10,
        findings: [
          {
            status: 'fail',
            message: 'No docs/prompts or .cursor/rules prompt assets found',
          },
        ],
      },
    ];
    const { missing } = buildMissingAndRecommendations(categories, '/tmp/repo');
    expect(missing).toContain('docs/prompts/');
  });

  it('flags missing typecheck script from workflow warnings', () => {
    const categories: CategoryResult[] = [
      {
        id: 'workflow',
        label: 'Workflow',
        score: 10,
        maxScore: 15,
        findings: [
          {
            status: 'warn',
            message:
              'Missing typecheck script — recommend adding explicit typecheck',
          },
        ],
      },
    ];
    const { missing, recommendations } = buildMissingAndRecommendations(
      categories,
      '/tmp/repo',
    );
    expect(missing).toContain('typecheck script');
    expect(recommendations.some((r) => r.includes('typecheck'))).toBe(true);
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
