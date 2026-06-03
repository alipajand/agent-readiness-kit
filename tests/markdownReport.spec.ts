import { describe, it, expect } from 'vitest';
import { formatMarkdownReport } from '../src/report/markdownReport.js';
import type { AuditResult } from '../src/types.js';

const sampleResult: AuditResult = {
  repoPath: '/tmp/sample',
  score: 42,
  categories: [
    {
      id: 'agent-instructions',
      label: 'Agent instructions',
      score: 0,
      maxScore: 20,
      findings: [{ status: 'fail', message: 'AGENTS.md not found' }],
    },
  ],
  missing: ['AGENTS.md'],
  recommendations: ['Add AGENTS.md', 'Add docs/ARCHITECTURE.md'],
};

describe('markdownReport', () => {
  it('includes title, score, table, and timestamp', () => {
    const md = formatMarkdownReport(sampleResult);
    expect(md).toContain('# Agent Readiness Report');
    expect(md).toContain('42 / 100');
    expect(md).toContain('| Category | Score | Max |');
    expect(md).toContain('AGENTS.md not found');
    expect(md).toContain('## Recommended next actions');
    expect(md).toMatch(/Generated:\*\* \d{4}-\d{2}-\d{2}T/);
  });

  it('renders recommendations as an ordered list without bullet prefixes', () => {
    const md = formatMarkdownReport(sampleResult);
    const section = md.split('## Recommended next actions')[1] ?? '';
    expect(section).toContain('1. Add AGENTS.md');
    expect(section).toContain('2. Add docs/ARCHITECTURE.md');
    expect(section).not.toMatch(/^\s*-\s*1\./m);
  });
});
