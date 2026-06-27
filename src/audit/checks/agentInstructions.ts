import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import {
  fileHasPlaceholderContent,
  PLACEHOLDER_WARNING,
} from '../placeholderDetection.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 20;

// Read a directory's entry names, preserving exact case so we can tell
// `CLAUDE.md` from `claude.md` even on case-insensitive filesystems (macOS,
// Windows), where `fileExists` cannot distinguish the two. Returns [] when the
// directory is missing.
async function listEntryNames(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

export async function checkAgentInstructions(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  const detected: string[] = [];

  const agentsMd = path.join(repoPath, 'AGENTS.md');
  const cursorRules = path.join(repoPath, '.cursorrules');
  const copilot = path.join(repoPath, '.github', 'copilot-instructions.md');

  if (await fileExists(agentsMd)) {
    detected.push('AGENTS.md');
    findings.push({
      status: 'pass',
      message: 'AGENTS.md found',
      files: ['AGENTS.md'],
    });
    if (await fileHasPlaceholderContent(agentsMd)) {
      findings.push({
        status: 'warn',
        message: `${PLACEHOLDER_WARNING} (AGENTS.md)`,
        files: ['AGENTS.md'],
      });
    }
  } else {
    findings.push({ status: 'fail', message: 'AGENTS.md not found' });
  }

  if (await fileExists(cursorRules)) {
    detected.push('.cursorrules');
    findings.push({
      status: 'pass',
      message: '.cursorrules found',
      files: ['.cursorrules'],
    });
  }

  const cursorMdc = await findFiles(repoPath, '.cursor/rules/**/*.mdc');
  if (cursorMdc.length > 0) {
    detected.push(...cursorMdc.map((f) => path.relative(repoPath, f)));
    findings.push({
      status: 'pass',
      message: 'Cursor rules (.mdc) found',
      files: cursorMdc.map((f) => path.relative(repoPath, f)),
    });
  }

  // Claude Code files. CLAUDE.md at the repo root is canonical; lowercase and
  // nested `.claude/` variants are recognized because real repos use them.
  const rootEntries = await listEntryNames(repoPath);
  const hasRootClaude = rootEntries.includes('CLAUDE.md');
  const hasLowercaseClaude = rootEntries.includes('claude.md');

  if (hasRootClaude) {
    detected.push('CLAUDE.md');
    findings.push({
      status: 'pass',
      message: 'CLAUDE.md found',
      files: ['CLAUDE.md'],
    });
  } else if (hasLowercaseClaude) {
    detected.push('claude.md');
    findings.push({
      status: 'pass',
      message: 'claude.md found',
      files: ['claude.md'],
    });
    findings.push({
      status: 'warn',
      message:
        'Found lowercase claude.md — rename it to the canonical CLAUDE.md (or run `ark generate claude`)',
      files: ['claude.md'],
    });
  }

  const dotClaudeEntries = await listEntryNames(path.join(repoPath, '.claude'));
  const dotClaudeFiles: string[] = [];
  if (dotClaudeEntries.includes('CLAUDE.md'))
    dotClaudeFiles.push('.claude/CLAUDE.md');
  if (dotClaudeEntries.includes('claude.md'))
    dotClaudeFiles.push('.claude/claude.md');
  if (dotClaudeFiles.length > 0) {
    detected.push(...dotClaudeFiles);
    findings.push({
      status: 'pass',
      message: 'Claude-specific instructions found (.claude/)',
      files: dotClaudeFiles,
    });
  }

  const claudeCommands = await findFiles(repoPath, '.claude/commands/**/*.md');
  if (claudeCommands.length > 0) {
    const relCommands = claudeCommands.map((f) => path.relative(repoPath, f));
    detected.push(...relCommands);
    findings.push({
      status: 'pass',
      message:
        'Claude command files found (.claude/commands/) — useful agent context, not a replacement for a root CLAUDE.md',
      files: relCommands,
    });
  }

  if (await fileExists(copilot)) {
    detected.push('.github/copilot-instructions.md');
    findings.push({
      status: 'pass',
      message: 'GitHub Copilot instructions found',
      files: ['.github/copilot-instructions.md'],
    });
  }

  const hasAgents = detected.includes('AGENTS.md');
  const toolSpecific = detected.filter((f) => f !== 'AGENTS.md');

  let score = 0;
  if (hasAgents && toolSpecific.length > 0) {
    score = 20;
    findings.push({
      status: 'pass',
      message: 'AGENTS.md plus tool-specific instructions (full score)',
    });
  } else if (hasAgents) {
    score = 15;
    findings.push({
      status: 'warn',
      message: 'AGENTS.md only — add tool-specific instructions for full score',
    });
  } else if (toolSpecific.length > 0) {
    score = 10;
    findings.push({
      status: 'warn',
      message:
        'Tool-specific instructions only — add AGENTS.md for higher score',
    });
  } else {
    findings.push({
      status: 'fail',
      message: 'No agent instruction files detected',
    });
  }

  return {
    id: 'agent-instructions',
    label: 'Agent instructions',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
