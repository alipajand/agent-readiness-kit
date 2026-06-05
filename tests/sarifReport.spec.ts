import { describe, it, expect } from 'vitest';
import { formatSarifReport } from '../src/report/sarifReport.js';
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

describe('formatSarifReport', () => {
  it('produces a valid SARIF 2.1.0 document', () => {
    const sarif = JSON.parse(formatSarifReport(sample));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe('ark');
  });

  it('emits one rule per category', () => {
    const sarif = JSON.parse(formatSarifReport(sample));
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.rules[0].id).toBe('agent-instructions');
  });

  it('only reports non-pass findings as results', () => {
    const sarif = JSON.parse(formatSarifReport(sample));
    const results = sarif.runs[0].results;
    expect(results).toHaveLength(2);
    const levels = results.map((r: { level: string }) => r.level).sort();
    expect(levels).toEqual(['error', 'warning']);
  });

  it('attaches file locations to findings', () => {
    const sarif = JSON.parse(formatSarifReport(sample));
    const failResult = sarif.runs[0].results.find(
      (r: { level: string }) => r.level === 'error',
    );
    expect(failResult.locations[0].physicalLocation.artifactLocation.uri).toBe(
      'CLAUDE.md',
    );
  });
});
