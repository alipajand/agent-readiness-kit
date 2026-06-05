import { describe, it, expect } from 'vitest';
import { formatBadgeSvg } from '../src/report/badgeReport.js';
import type { AuditResult } from '../src/types.js';

function makeResult(score: number): AuditResult {
  return {
    repoPath: '/tmp/x',
    score,
    categories: [],
    missing: [],
    recommendations: [],
  };
}

describe('formatBadgeSvg', () => {
  it('produces an SVG with the score value', () => {
    const svg = formatBadgeSvg(makeResult(73));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('73/100');
    expect(svg).toContain('agent readiness');
  });

  it('uses green for high scores', () => {
    expect(formatBadgeSvg(makeResult(90))).toContain('#22c55e');
  });

  it('uses red for low scores', () => {
    expect(formatBadgeSvg(makeResult(10))).toContain('#ef4444');
  });

  it('varies width with score digit count', () => {
    const two = formatBadgeSvg(makeResult(50));
    const three = formatBadgeSvg(makeResult(100));
    const widthOf = (svg: string) =>
      Number(svg.match(/width="(\d+)" height="20"/)?.[1]);
    expect(widthOf(three)).toBeGreaterThan(widthOf(two));
  });
});
