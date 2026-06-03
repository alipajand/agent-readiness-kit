import type { AuditJson, AuditResult } from '../types.js';

export function toAuditJson(result: AuditResult): AuditJson {
  return {
    repoPath: result.repoPath,
    score: result.score,
    categories: result.categories.map((c) => ({
      id: c.id,
      label: c.label,
      score: c.score,
      maxScore: c.maxScore,
      findings: c.findings,
    })),
    missing: result.missing,
    recommendations: result.recommendations,
  };
}

export function formatAuditJson(result: AuditResult): string {
  return JSON.stringify(toAuditJson(result), null, 2);
}
