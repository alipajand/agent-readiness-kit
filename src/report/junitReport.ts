import type { AuditResult } from '../types.js';

function escXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatJunitReport(result: AuditResult): string {
  const timestamp = new Date().toISOString();
  let totalTests = 0;
  let totalFailures = 0;
  let totalWarnings = 0;

  const testSuites = result.categories
    .map((cat) => {
      const tests = cat.findings.length;
      const failures = cat.findings.filter((f) => f.status === 'fail').length;
      const warnings = cat.findings.filter((f) => f.status === 'warn').length;
      totalTests += tests;
      totalFailures += failures;
      totalWarnings += warnings;

      const testCases = cat.findings
        .map((f) => {
          const name = escXml(f.message);
          const classname = escXml(cat.id);
          if (f.status === 'fail') {
            return `      <testcase name="${name}" classname="${classname}">
        <failure message="${name}" type="fail">${escXml(f.files?.join(', ') ?? '')}</failure>
      </testcase>`;
          }
          if (f.status === 'warn') {
            return `      <testcase name="${name}" classname="${classname}">
        <system-out>WARN: ${escXml(f.files?.join(', ') ?? '')}</system-out>
      </testcase>`;
          }
          return `      <testcase name="${name}" classname="${classname}" />`;
        })
        .join('\n');

      return `  <testsuite name="${escXml(cat.label)}" tests="${tests}" failures="${failures}" skipped="${warnings}" timestamp="${escXml(timestamp)}" score="${cat.score}/${cat.maxScore}">
${testCases}
  </testsuite>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="agent-readiness-kit" tests="${totalTests}" failures="${totalFailures}" skipped="${totalWarnings}" timestamp="${escXml(timestamp)}">
${testSuites}
</testsuites>`;
}
