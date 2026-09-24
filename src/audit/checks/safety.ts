import path from 'node:path';
import { fileExists, dirExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import { readTextFile } from '../../fs/readTextFile.js';
import { isRealpathWithin } from '../../fs/safePath.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 15;

const SAFETY_KEYWORDS = [
  'security',
  'secrets',
  'environment variable',
  'environment variables',
  '.env',
  'auth',
  'authorization',
  'tenant',
  'migration',
  'rollback',
  'production',
  'generated code',
];

const SAFETY_PATHS = [
  '.env.example',
  'SECURITY.md',
  'docs/security',
  'docs/operations',
  'docs/runbooks',
  'docs/migrations',
  'docs/MIGRATIONS.md',
];

const UNRESTRICTED_SHELL = /^Bash(?:\((?:\*|:\*)?\))?$/;

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/**
 * Committed Claude Code settings: deny rules that keep secrets out of reach
 * earn points, and settings that let the agent act without asking cost them.
 */
async function claudeSettings(
  repoPath: string,
): Promise<{ points: number; findings: Finding[] }> {
  const rel = '.claude/settings.json';
  const full = path.join(repoPath, rel);
  if (!isRealpathWithin(repoPath, full)) return { points: 0, findings: [] };
  const text = await readTextFile(full);
  if (text === null) return { points: 0, findings: [] };

  let settings: unknown;
  try {
    settings = JSON.parse(text);
  } catch {
    return {
      points: 0,
      findings: [
        { status: 'warn', message: `${rel} is not valid JSON`, files: [rel] },
      ],
    };
  }

  const root =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)
      : {};
  const permissions =
    typeof root.permissions === 'object' && root.permissions !== null
      ? (root.permissions as Record<string, unknown>)
      : {};
  const findings: Finding[] = [];
  let points = 0;

  if (strings(permissions.deny).some((rule) => rule.includes('.env'))) {
    points += 2;
    findings.push({
      status: 'pass',
      message: 'Claude Code settings deny reading .env files',
      files: [rel],
    });
  } else {
    findings.push({
      status: 'warn',
      message:
        'Claude Code settings do not deny reading .env files — add "Read(./.env)" to permissions.deny',
      files: [rel],
    });
  }

  const bypass = permissions.defaultMode === 'bypassPermissions';
  const openShell = strings(permissions.allow).some((rule) =>
    UNRESTRICTED_SHELL.test(rule.replace(/\s+/g, '')),
  );
  if (bypass || openShell) {
    points -= 5;
    findings.push({
      status: 'fail',
      message: bypass
        ? 'Claude Code settings bypass every permission prompt (defaultMode: bypassPermissions)'
        : 'Claude Code settings allow any shell command without asking',
      files: [rel],
    });
  }

  if (root.enableAllProjectMcpServers === true) {
    findings.push({
      status: 'warn',
      message:
        'Claude Code settings auto-approve every MCP server in the repository (enableAllProjectMcpServers)',
      files: [rel],
    });
  }

  return { points, findings };
}

async function fileMentionsSafety(filePath: string): Promise<boolean> {
  const content = (await readTextFile(filePath))?.toLowerCase();
  if (content === undefined) return false;
  return SAFETY_KEYWORDS.some((kw) => content.includes(kw.toLowerCase()));
}

export async function checkSafety(repoPath: string): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;
  const foundFiles: string[] = [];

  for (const rel of SAFETY_PATHS) {
    const full = path.join(repoPath, rel);
    if ((await fileExists(full)) || (await dirExists(full))) {
      foundFiles.push(rel);
      score += 3;
    }
  }
  score = Math.min(9, score);

  const docCandidates = await findFiles(repoPath, [
    'docs/**/*.md',
    'README.md',
    'AGENTS.md',
    'CONTRIBUTING.md',
  ]);
  let keywordHits = 0;
  const keywordFiles: string[] = [];
  for (const file of docCandidates.slice(0, 30)) {
    if (await fileMentionsSafety(file)) {
      keywordHits++;
      keywordFiles.push(path.relative(repoPath, file));
    }
  }

  if (keywordHits > 0) {
    score += Math.min(6, keywordHits * 2);
    findings.push({
      status: 'pass',
      message: `Docs mention safety topics (${keywordHits} files)`,
      files: keywordFiles.slice(0, 8),
    });
  }

  if (foundFiles.includes('.env.example')) {
    findings.push({
      status: 'pass',
      message: '.env.example found',
      files: ['.env.example'],
    });
  } else {
    findings.push({ status: 'fail', message: '.env.example not found' });
  }

  if (foundFiles.includes('SECURITY.md')) {
    findings.push({
      status: 'pass',
      message: 'SECURITY.md found',
      files: ['SECURITY.md'],
    });
  }

  for (const f of foundFiles) {
    if (f !== '.env.example' && f !== 'SECURITY.md') {
      findings.push({
        status: 'pass',
        message: `Safety/ops doc: ${f}`,
        files: [f],
      });
    }
  }

  const claude = await claudeSettings(repoPath);
  score = Math.max(0, score + claude.points);
  findings.push(...claude.findings);

  if (score < 5) {
    findings.push({
      status: 'warn',
      message: 'Limited safety boundary documentation for agents',
    });
  }

  score = Math.min(MAX_SCORE, score);

  return {
    id: 'safety',
    label: 'Safety boundaries',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
