import type { AuditResult } from '../types.js';

export function formatMarkdownReport(result: AuditResult): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push('# Agent Readiness Report');
  lines.push('');
  lines.push(`**Repository:** \`${result.repoPath}\``);
  lines.push(`**Score:** ${result.score} / 100`);
  lines.push(`**Generated:** ${timestamp}`);
  lines.push('');

  lines.push('## Category scores');
  lines.push('');
  lines.push('| Category | Score | Max |');
  lines.push('| --- | ---: | ---: |');
  for (const cat of result.categories) {
    lines.push(`| ${cat.label} | ${cat.score} | ${cat.maxScore} |`);
  }
  lines.push('');

  lines.push('## Findings');
  lines.push('');
  for (const cat of result.categories) {
    lines.push(`### ${cat.label} (${cat.score}/${cat.maxScore})`);
    lines.push('');
    for (const f of cat.findings) {
      const icon = f.status === 'pass' ? '✅' : f.status === 'warn' ? '⚠️' : '❌';
      lines.push(`- ${icon} ${f.message}`);
      if (f.files?.length) {
        lines.push(`  - Files: ${f.files.map((x) => `\`${x}\``).join(', ')}`);
      }
    }
    lines.push('');
  }

  lines.push('## Missing items');
  lines.push('');
  if (result.missing.length === 0) {
    lines.push('_None flagged._');
  } else {
    for (const m of result.missing) {
      lines.push(`- ${m}`);
    }
  }
  lines.push('');

  lines.push('## Recommended next actions');
  lines.push('');
  if (result.recommendations.length === 0) {
    lines.push('1. Review category findings and tighten agent boundaries.');
  } else {
    result.recommendations.forEach((rec, i) => {
      const text = rec.replace(/^\d+\.\s*/, '').trim();
      lines.push(`${i + 1}. ${text}`);
    });
  }
  lines.push('');

  return lines.join('\n');
}
