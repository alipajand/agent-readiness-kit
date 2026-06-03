import path from 'node:path';
import { readJsonFile } from '../../fs/writeFileSafe.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 15;

const ALL_SCRIPTS = [
  'dev',
  'build',
  'lint',
  'test',
  'typecheck',
  'format',
  'clean',
] as const;

const SCRIPT_POINTS: Record<(typeof ALL_SCRIPTS)[number], number> = {
  dev: 2,
  build: 3,
  lint: 2,
  test: 3,
  typecheck: 3,
  format: 1,
  clean: 1,
};

type PackageJson = { scripts?: Record<string, string> };

export async function checkWorkflow(repoPath: string): Promise<CategoryResult> {
  const findings: Finding[] = [];
  const pkgPath = path.join(repoPath, 'package.json');
  const pkg = await readJsonFile<PackageJson>(pkgPath);
  const scripts = pkg?.scripts ?? {};

  if (Object.keys(scripts).length === 0) {
    return {
      id: 'workflow',
      label: 'Developer workflow clarity',
      score: 0,
      maxScore: MAX_SCORE,
      findings: [{ status: 'fail', message: 'No package.json scripts found' }],
    };
  }

  const present: string[] = [];
  const missing: string[] = [];

  for (const name of ALL_SCRIPTS) {
    if (scripts[name]) {
      present.push(name);
    } else {
      missing.push(name);
    }
  }

  let score = 0;
  for (const name of ALL_SCRIPTS) {
    if (scripts[name]) score += SCRIPT_POINTS[name];
  }
  score = Math.min(MAX_SCORE, score);

  findings.push({
    status: 'pass',
    message: `Scripts present: ${present.join(', ') || 'none'}`,
    files: present.map((s) => `package.json#scripts.${s}`),
  });

  if (!scripts.test) {
    findings.push({
      status: 'fail',
      message: 'Missing test script — agents need a clear test command',
    });
  }
  if (!scripts.typecheck) {
    findings.push({
      status: 'warn',
      message: 'Missing typecheck script — recommend adding explicit typecheck',
    });
  }

  for (const name of ['dev', 'build', 'lint'] as const) {
    if (!scripts[name]) {
      findings.push({ status: 'warn', message: `Missing script: ${name}` });
    }
  }

  return {
    id: 'workflow',
    label: 'Developer workflow clarity',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
