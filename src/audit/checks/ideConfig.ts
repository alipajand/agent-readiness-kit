import path from 'node:path';
import { fileExists, dirExists } from '../../fs/fileExists.js';
import { findFiles } from '../../fs/findFiles.js';
import type { CategoryResult, Finding } from '../../types.js';

const MAX_SCORE = 5;

export async function checkIdeConfig(
  repoPath: string,
): Promise<CategoryResult> {
  const findings: Finding[] = [];
  let score = 0;

  // .vscode directory
  const vscodeDir = path.join(repoPath, '.vscode');
  if (await dirExists(vscodeDir)) {
    score += 1;
    findings.push({
      status: 'pass',
      message: '.vscode directory present',
      files: ['.vscode'],
    });
  }

  // .vscode/settings.json
  if (await fileExists(path.join(repoPath, '.vscode', 'settings.json'))) {
    score += 1;
    findings.push({
      status: 'pass',
      message: '.vscode/settings.json found',
      files: ['.vscode/settings.json'],
    });
  }

  // .vscode/extensions.json — recommended extensions
  if (await fileExists(path.join(repoPath, '.vscode', 'extensions.json'))) {
    score += 1;
    findings.push({
      status: 'pass',
      message: '.vscode/extensions.json found (recommended extensions)',
      files: ['.vscode/extensions.json'],
    });
  }

  // .vscode/launch.json — debug configurations
  if (await fileExists(path.join(repoPath, '.vscode', 'launch.json'))) {
    score += 1;
    findings.push({
      status: 'pass',
      message: '.vscode/launch.json found (debug configurations)',
      files: ['.vscode/launch.json'],
    });
  }

  // .vscode/tasks.json
  if (await fileExists(path.join(repoPath, '.vscode', 'tasks.json'))) {
    score += 1;
    findings.push({
      status: 'pass',
      message: '.vscode/tasks.json found',
      files: ['.vscode/tasks.json'],
    });
  }

  // JetBrains .idea
  const ideaDir = path.join(repoPath, '.idea');
  if (await dirExists(ideaDir)) {
    score += 1;
    findings.push({
      status: 'pass',
      message: '.idea directory present (JetBrains IDE config)',
      files: ['.idea'],
    });
  }

  // Workspace file
  const workspaceFiles = await findFiles(repoPath, '*.code-workspace');
  if (workspaceFiles.length > 0) {
    score += 1;
    findings.push({
      status: 'pass',
      message: 'VS Code workspace file found',
      files: workspaceFiles.map((f) => path.relative(repoPath, f)).slice(0, 3),
    });
  }

  score = Math.min(MAX_SCORE, score);

  if (score === 0) {
    findings.push({
      status: 'warn',
      message: 'No IDE configuration found (.vscode/)',
    });
  }

  return {
    id: 'ide-config',
    label: 'IDE configuration',
    score,
    maxScore: MAX_SCORE,
    findings,
  };
}
