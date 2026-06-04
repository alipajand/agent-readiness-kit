import pc from 'picocolors';
import type { AuditJson } from '../types.js';

export type DiffResult = {
  before: AuditJson;
  after: AuditJson;
  scoreDelta: number;
  categoryDeltas: Array<{
    id: string;
    label: string;
    before: number;
    after: number;
    delta: number;
  }>;
  newCategories: Array<{ id: string; label: string; score: number; maxScore: number }>;
  removedCategories: Array<{ id: string; label: string }>;
};

export function computeDiff(before: AuditJson, after: AuditJson): DiffResult {
  const beforeMap = new Map(before.categories.map((c) => [c.id, c]));
  const afterMap = new Map(after.categories.map((c) => [c.id, c]));

  const categoryDeltas = [];
  for (const [id, aCat] of afterMap) {
    const bCat = beforeMap.get(id);
    if (bCat) {
      categoryDeltas.push({
        id,
        label: aCat.label,
        before: bCat.score,
        after: aCat.score,
        delta: aCat.score - bCat.score,
      });
    }
  }

  const newCategories = after.categories
    .filter((c) => !beforeMap.has(c.id))
    .map((c) => ({ id: c.id, label: c.label, score: c.score, maxScore: c.maxScore }));

  const removedCategories = before.categories
    .filter((c) => !afterMap.has(c.id))
    .map((c) => ({ id: c.id, label: c.label }));

  return {
    before,
    after,
    scoreDelta: after.score - before.score,
    categoryDeltas,
    newCategories,
    removedCategories,
  };
}

export function formatDiffReport(diff: DiffResult): string {
  const lines: string[] = [];

  lines.push(pc.bold('Agent Readiness Score Diff'));
  lines.push('');

  const deltaSign = diff.scoreDelta > 0 ? '+' : '';
  const deltaColor =
    diff.scoreDelta > 0
      ? pc.green
      : diff.scoreDelta < 0
        ? pc.red
        : pc.dim;

  lines.push(
    `  Score: ${pc.cyan(String(diff.before.score))} → ${pc.cyan(String(diff.after.score))}  (${deltaColor(`${deltaSign}${diff.scoreDelta}`)})`,
  );
  lines.push('');
  lines.push(pc.bold('Category changes:'));

  for (const cat of diff.categoryDeltas) {
    if (cat.delta === 0) {
      lines.push(`  ${pc.dim('=')} ${cat.label}: ${cat.before} (no change)`);
    } else {
      const sign = cat.delta > 0 ? '+' : '';
      const col = cat.delta > 0 ? pc.green : pc.red;
      lines.push(
        `  ${col(cat.delta > 0 ? '▲' : '▼')} ${cat.label}: ${cat.before} → ${cat.after}  (${col(`${sign}${cat.delta}`)})`,
      );
    }
  }

  if (diff.newCategories.length > 0) {
    lines.push('');
    lines.push(pc.bold('New categories (in after):'));
    for (const c of diff.newCategories) {
      lines.push(`  ${pc.green('+')} ${c.label}: ${c.score}/${c.maxScore}`);
    }
  }

  if (diff.removedCategories.length > 0) {
    lines.push('');
    lines.push(pc.bold('Removed categories (in before only):'));
    for (const c of diff.removedCategories) {
      lines.push(`  ${pc.red('-')} ${c.label}`);
    }
  }

  if (diff.after.recommendations.length > 0) {
    lines.push('');
    lines.push(pc.bold('Current recommendations:'));
    diff.after.recommendations.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec.replace(/^\d+\.\s*/, '')}`);
    });
  }

  return lines.join('\n');
}
