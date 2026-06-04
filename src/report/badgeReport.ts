import type { AuditResult } from '../types.js';

function badgeColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export function formatBadgeSvg(result: AuditResult): string {
  const label = 'agent readiness';
  const value = `${result.score}/100`;
  const color = badgeColor(result.score);

  // Approximate text widths (monospace estimate)
  const labelWidth = label.length * 6 + 12;
  const valueWidth = value.length * 7 + 12;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${Math.round(labelWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${Math.round(labelWidth / 2)}" y="14">${label}</text>
    <text x="${Math.round(labelWidth + valueWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${Math.round(labelWidth + valueWidth / 2)}" y="14">${value}</text>
  </g>
</svg>`;
}
