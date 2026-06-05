import { describe, it, expect } from 'vitest';
import { formatJunitReport } from '../src/report/junitReport.js';
import type { AuditResult } from '../src/types.js';

const sample: AuditResult = {
  repoPath: '/tmp/sample',
  score: 30,
  categories: [
    {
      id: 'agent-instructions',
      label: 'Agent instructions',
      score: 10,
      maxScore: 20,
      findings: [
        { status: 'pass', message: 'AGENTS.md found', files: ['AGENTS.md'] },
        { status: 'warn', message: 'Add tool-specific instructions' },
        {
          status: 'fail',
          message: 'CLAUDE.md not found',
          files: ['CLAUDE.md'],
        },
      ],
    },
  ],
  missing: [],
  recommendations: [],
};

describe('formatJunitReport', () => {
  it('produces a valid JUnit XML document', () => {
    const xml = formatJunitReport(sample);
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(xml).toContain('<testsuites');
    expect(xml).toContain('<testsuite');
  });

  it('aggregates totals across findings', () => {
    const xml = formatJunitReport(sample);
    expect(xml).toContain('tests="3"');
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('skipped="1"');
  });

  it('renders failures and warnings distinctly', () => {
    const xml = formatJunitReport(sample);
    expect(xml).toContain('<failure');
    expect(xml).toContain('WARN:');
  });

  it('handles an empty category list', () => {
    const xml = formatJunitReport({ ...sample, categories: [] });
    expect(xml).toContain('tests="0"');
    expect(xml).toContain('failures="0"');
  });
});
