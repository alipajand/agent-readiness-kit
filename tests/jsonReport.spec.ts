import { describe, it, expect } from 'vitest';
import { toAuditJson, formatAuditJson } from '../src/report/jsonReport.js';
import type { AuditResult } from '../src/types.js';

const sample: AuditResult = {
  repoPath: '/tmp/sample',
  score: 55,
  categories: [
    {
      id: 'agent-instructions',
      label: 'Agent instructions',
      score: 15,
      maxScore: 20,
      findings: [
        { status: 'pass', message: 'AGENTS.md found', files: ['AGENTS.md'] },
      ],
    },
  ],
  missing: ['CLAUDE.md'],
  recommendations: ['Add CLAUDE.md'],
};

describe('toAuditJson', () => {
  it('maps the audit result into a plain JSON object', () => {
    const json = toAuditJson(sample);
    expect(json.score).toBe(55);
    expect(json.repoPath).toBe('/tmp/sample');
    expect(json.categories).toHaveLength(1);
    expect(json.categories[0].findings[0].files).toEqual(['AGENTS.md']);
    expect(json.missing).toEqual(['CLAUDE.md']);
  });
});

describe('formatAuditJson', () => {
  it('produces parseable, pretty-printed JSON', () => {
    const text = formatAuditJson(sample);
    expect(text).toContain('\n');
    const parsed = JSON.parse(text);
    expect(parsed.score).toBe(55);
    expect(parsed.categories[0].id).toBe('agent-instructions');
  });
});
