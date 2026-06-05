import { describe, it, expect } from 'vitest';
import { formatTerminalReport } from '../src/report/terminalReport.js';
import type { AuditResult } from '../src/types.js';

const sample: AuditResult = {
  repoPath: '/tmp/sample',
  score: 42,
  categories: [
    {
      id: 'agent-instructions',
      label: 'Agent instructions',
      score: 15,
      maxScore: 20,
      findings: [
        { status: 'pass', message: 'AGENTS.md found', files: ['AGENTS.md'] },
        { status: 'fail', message: 'CLAUDE.md not found' },
      ],
    },
  ],
  missing: ['CLAUDE.md'],
  recommendations: ['Add CLAUDE.md'],
};

describe('formatTerminalReport', () => {
  it('includes repo path, score, and category scores', () => {
    const out = formatTerminalReport(sample);
    expect(out).toContain('/tmp/sample');
    expect(out).toContain('42');
    expect(out).toContain('Agent instructions: 15/20');
  });

  it('lists strong items and missing items', () => {
    const out = formatTerminalReport(sample);
    expect(out).toContain('AGENTS.md found');
    expect(out).toContain('CLAUDE.md');
  });

  it('shows a positive score delta', () => {
    const out = formatTerminalReport(sample, 8);
    expect(out).toContain('+8');
  });

  it('shows a negative score delta', () => {
    const out = formatTerminalReport(sample, -5);
    expect(out).toContain('-5');
  });

  it('shows no-change messaging for a zero delta', () => {
    const out = formatTerminalReport(sample, 0);
    expect(out).toContain('no change');
  });

  it('falls back to a default recommendation when none provided', () => {
    const out = formatTerminalReport({ ...sample, recommendations: [] });
    expect(out).toContain('Recommended next actions');
  });
});
