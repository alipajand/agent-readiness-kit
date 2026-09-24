import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/version.js';
import { formatSarifReport } from '../src/report/sarifReport.js';
import type { AuditResult } from '../src/types.js';

describe('VERSION', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    expect(VERSION).toBe(pkg.version);
  });

  it('is reported as the SARIF tool version', () => {
    const result = {
      repoPath: '/repo',
      score: 100,
      categories: [],
    } as unknown as AuditResult;
    const driver = JSON.parse(formatSarifReport(result)).runs[0].tool.driver;
    expect(driver.version).toBe(VERSION);
    expect(driver.informationUri).toBe(
      'https://github.com/alipajand/agent-readiness-kit',
    );
  });
});
