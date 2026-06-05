import { describe, it, expect } from 'vitest';
import {
  arkrcSchema,
  auditOptionsSchema,
  initOptionsSchema,
  generateOptionsSchema,
} from '../src/config/schema.js';

describe('auditOptionsSchema', () => {
  it('accepts a valid audit options object', () => {
    const parsed = auditOptionsSchema.parse({
      repoPath: '.',
      json: true,
      output: 'report.md',
    });
    expect(parsed.json).toBe(true);
  });

  it('accepts an empty object (all fields optional)', () => {
    expect(auditOptionsSchema.parse({})).toEqual({});
  });

  it('rejects a non-boolean json value', () => {
    expect(auditOptionsSchema.safeParse({ json: 'yes' }).success).toBe(false);
  });

  it('rejects an empty repoPath string', () => {
    expect(auditOptionsSchema.safeParse({ repoPath: '' }).success).toBe(false);
  });
});

describe('initOptionsSchema and generateOptionsSchema', () => {
  it('accept a force flag', () => {
    expect(initOptionsSchema.parse({ force: true }).force).toBe(true);
    expect(generateOptionsSchema.parse({ force: false }).force).toBe(false);
  });

  it('reject non-boolean force values', () => {
    expect(initOptionsSchema.safeParse({ force: 1 }).success).toBe(false);
    expect(generateOptionsSchema.safeParse({ force: 'x' }).success).toBe(false);
  });
});

describe('arkrcSchema', () => {
  it('parses a full config with nested sections', () => {
    const parsed = arkrcSchema.parse({
      audit: { json: true, output: 'docs/report.md' },
      init: { force: true },
      generate: { force: false },
    });
    expect(parsed.audit?.json).toBe(true);
    expect(parsed.init?.force).toBe(true);
  });

  it('accepts an empty config', () => {
    expect(arkrcSchema.parse({})).toEqual({});
  });

  it('rejects an invalid nested section', () => {
    expect(arkrcSchema.safeParse({ audit: { json: 'nope' } }).success).toBe(
      false,
    );
  });
});
