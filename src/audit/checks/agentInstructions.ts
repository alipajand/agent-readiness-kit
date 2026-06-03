import path from 'node:path';
import { fileExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import {
  fileHasPlaceholderContent,
  PLACEHOLDER_WARNING,
} from '../placeholderDetection.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 20;

export async function checkAgentInstructions(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  const detected: string[] = [];

  const agentsMd = path.join(repoPath, 'AGENTS.md');
  const cursorRules = path.join(repoPath, '.cursorrules');
  const claudeMd = path.join(repoPath, 'CLAUDE.md');
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

  if (await fileExists(claudeMd)) {
    detected.push('CLAUDE.md');
    findings.push({
      status: 'pass',
      message: 'CLAUDE.md found',
      files: ['CLAUDE.md'],
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
