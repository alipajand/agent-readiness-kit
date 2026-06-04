import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkIdeConfig } from '../src/audit/checks/ideConfig.js';

describe('checkIdeConfig', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-ide-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 and warns when no IDE config exists', async () => {
    const result = await checkIdeConfig(repoPath);
    expect(result.score).toBe(0);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('awards points for .vscode directory', async () => {
    await mkdir(path.join(repoPath, '.vscode'), { recursive: true });
    const result = await checkIdeConfig(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.findings.some((f) => f.message.includes('.vscode directory'))).toBe(true);
  });

  it('awards points for .vscode/settings.json', async () => {
    await mkdir(path.join(repoPath, '.vscode'), { recursive: true });
    await writeFile(path.join(repoPath, '.vscode', 'settings.json'), '{}');
    const result = await checkIdeConfig(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.findings.some((f) => f.message.includes('settings.json'))).toBe(true);
  });

  it('awards points for .vscode/extensions.json', async () => {
    await mkdir(path.join(repoPath, '.vscode'), { recursive: true });
    await writeFile(
      path.join(repoPath, '.vscode', 'extensions.json'),
      '{"recommendations":[]}',
    );
    const result = await checkIdeConfig(repoPath);
    expect(result.findings.some((f) => f.message.includes('extensions.json'))).toBe(true);
  });

  it('caps score at maxScore', async () => {
    await mkdir(path.join(repoPath, '.vscode'), { recursive: true });
    await writeFile(path.join(repoPath, '.vscode', 'settings.json'), '{}');
    await writeFile(path.join(repoPath, '.vscode', 'extensions.json'), '{}');
    await writeFile(path.join(repoPath, '.vscode', 'launch.json'), '{}');
    await writeFile(path.join(repoPath, '.vscode', 'tasks.json'), '{}');
    const result = await checkIdeConfig(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
    expect(result.maxScore).toBe(5);
  });
});
