import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkAgentInstructions } from '../src/audit/checks/agentInstructions.js';

describe('checkAgentInstructions', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-agentinstr-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 when no instruction files are present', async () => {
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(20);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('scores full points with AGENTS.md plus a tool-specific file', async () => {
    await writeFile(
      path.join(repoPath, 'AGENTS.md'),
      '# Agents\nReal content.',
    );
    await writeFile(path.join(repoPath, '.cursorrules'), 'rules');
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(20);
    expect(result.findings.some((f) => f.status === 'pass')).toBe(true);
  });

  it('scores partial points for AGENTS.md only', async () => {
    await writeFile(
      path.join(repoPath, 'AGENTS.md'),
      '# Agents\nReal content.',
    );
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(15);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('scores partial points for tool-specific instructions only', async () => {
    await writeFile(path.join(repoPath, 'CLAUDE.md'), 'claude');
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(10);
    expect(result.findings.some((f) => f.status === 'warn')).toBe(true);
  });

  it('detects cursor .mdc rules as tool-specific instructions', async () => {
    await writeFile(
      path.join(repoPath, 'AGENTS.md'),
      '# Agents\nReal content.',
    );
    await mkdir(path.join(repoPath, '.cursor', 'rules'), { recursive: true });
    await writeFile(
      path.join(repoPath, '.cursor', 'rules', 'project.mdc'),
      '# rules',
    );
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(20);
    expect(
      result.findings.some(
        (f) => f.status === 'pass' && f.files?.[0]?.endsWith('.mdc'),
      ),
    ).toBe(true);
  });

  it('warns when AGENTS.md contains starter placeholders', async () => {
    await writeFile(
      path.join(repoPath, 'AGENTS.md'),
      '# Agents\n<!-- Describe what this project does -->',
    );
    const result = await checkAgentInstructions(repoPath);
    expect(
      result.findings.some(
        (f) => f.status === 'warn' && f.files?.includes('AGENTS.md'),
      ),
    ).toBe(true);
  });
});
