import pc from 'picocolors';
import type { AuditResult } from '../types.js';

export function formatTerminalReport(result: AuditResult): string {
  const lines: string[] = [];

  lines.push(pc.bold(`Repository: ${result.repoPath}`));
  lines.push('');
  lines.push(
    pc.bold(`Agent Readiness Score: ${pc.cyan(String(result.score))} / 100`),
  );

  lines.push('');
  lines.push(pc.bold('Category scores:'));
  for (const cat of result.categories) {
    lines.push(`  ${cat.label}: ${cat.score}/${cat.maxScore}`);
  }

  const strong: string[] = [];
  const missingDisplay: string[] = [];

  for (const cat of result.categories) {
    for (const f of cat.findings) {
      if (f.status === 'pass') {
        strong.push(f.message);
      }
      if (f.status === 'fail') {
        missingDisplay.push(f.message);
      }
    }
  }

  for (const m of result.missing) {
    if (!missingDisplay.some((d) => d.includes(m))) {
      missingDisplay.push(m);
    }
  }

  lines.push('');
  lines.push(pc.bold('Strong:'));
  const uniqueStrong = [...new Set(strong)].slice(0, 8);
  if (uniqueStrong.length === 0) {
    lines.push(`  ${pc.dim('(none yet)')}`);
  } else {
    for (const s of uniqueStrong) {
      lines.push(`  ${pc.green('✓')} ${s}`);
    }
  }

  lines.push('');
  lines.push(pc.bold('Missing:'));
  if (result.missing.length === 0 && missingDisplay.length === 0) {
    lines.push(`  ${pc.dim('(none flagged)')}`);
  } else {
    for (const m of result.missing) {
      lines.push(`  ${pc.red('✗')} ${m}`);
    }
    for (const d of missingDisplay.slice(0, 5)) {
      if (!result.missing.includes(d)) {
        lines.push(`  ${pc.red('✗')} ${d}`);
      }
    }
  }

  lines.push('');
  lines.push(pc.bold('Recommended next actions:'));
  if (result.recommendations.length === 0) {
    lines.push(`  ${pc.dim('1. Continue refining agent docs and safety boundaries')}`);
  } else {
    result.recommendations.forEach((rec, i) => {
      const text = rec.match(/^\d+\./) ? rec : `${i + 1}. ${rec}`;
      lines.push(`  ${text}`);
    });
  }

  return lines.join('\n');
}
