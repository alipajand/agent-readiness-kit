import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkContainerization } from '../src/audit/checks/containerization.js';

describe('checkContainerization', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-container-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 and warns when no containerization signals exist', async () => {
    const result = await checkContainerization(repoPath);
    expect(result.score).toBe(0);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('awards points for Dockerfile', async () => {
    await writeFile(path.join(repoPath, 'Dockerfile'), 'FROM node:20\n');
    const result = await checkContainerization(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.findings.some((f) => f.message.includes('Dockerfile'))).toBe(true);
  });

  it('awards points for docker-compose.yml', async () => {
    await writeFile(path.join(repoPath, 'docker-compose.yml'), 'version: "3"\n');
    const result = await checkContainerization(repoPath);
    expect(result.findings.some((f) => f.message.includes('Compose'))).toBe(true);
  });

  it('awards points for .dockerignore', async () => {
    await writeFile(path.join(repoPath, 'Dockerfile'), 'FROM node:20\n');
    await writeFile(path.join(repoPath, '.dockerignore'), 'node_modules\n');
    const result = await checkContainerization(repoPath);
    expect(result.findings.some((f) => f.message.includes('.dockerignore'))).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('caps score at maxScore', async () => {
    await writeFile(path.join(repoPath, 'Dockerfile'), 'FROM node:20\n');
    await writeFile(path.join(repoPath, 'docker-compose.yml'), 'version: "3"\n');
    await writeFile(path.join(repoPath, '.dockerignore'), 'node_modules\n');
    const result = await checkContainerization(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
    expect(result.maxScore).toBe(5);
  });
});
