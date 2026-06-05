import { describe, it, expect } from 'vitest';
import { formatHtmlReport } from '../src/report/htmlReport.js';
import type { AuditResult } from '../src/types.js';

const sample: AuditResult = {
  repoPath: '/tmp/sample',
  score: 42,
  categories: [
    {
      id: 'agent-instructions',
      label: 'Agent instructions',
      score: 20,
      maxScore: 20,
      findings: [
        { status: 'pass', message: 'AGENTS.md found', files: ['AGENTS.md'] },
        { status: 'warn', message: 'Tighten <boundaries> & rules' },
        { status: 'fail', message: 'CLAUDE.md not found' },
      ],
    },
  ],
  missing: ['CLAUDE.md'],
  recommendations: ['1. Add CLAUDE.md'],
};

describe('formatHtmlReport', () => {
  it('produces a complete HTML document with score and category', () => {
    const html = formatHtmlReport(sample);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('Agent Readiness Report');
    expect(html).toContain('Agent instructions');
    expect(html).toContain('42');
  });

  it('escapes HTML special characters in finding messages', () => {
    const html = formatHtmlReport(sample);
    expect(html).toContain('Tighten &lt;boundaries&gt; &amp; rules');
    expect(html).not.toContain('<boundaries>');
  });

  it('renders missing items and recommendations', () => {
    const html = formatHtmlReport(sample);
    expect(html).toContain('CLAUDE.md');
    expect(html).toContain('Add CLAUDE.md');
  });

  it('handles empty missing and recommendation lists', () => {
    const html = formatHtmlReport({
      ...sample,
      missing: [],
      recommendations: [],
    });
    expect(html).toContain('None flagged.');
    expect(html).toContain('No specific recommendations.');
  });
});
