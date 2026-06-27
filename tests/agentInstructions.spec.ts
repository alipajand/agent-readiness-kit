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

  it('detects root CLAUDE.md as the canonical Claude file', async () => {
    await writeFile(path.join(repoPath, 'CLAUDE.md'), '# Claude');
    const result = await checkAgentInstructions(repoPath);
    expect(
      result.findings.some(
        (f) => f.status === 'pass' && f.message === 'CLAUDE.md found',
      ),
    ).toBe(true);
    expect(
      result.findings.some((f) => /canonical CLAUDE\.md/.test(f.message)),
    ).toBe(false);
  });

  it('detects lowercase claude.md and warns to use canonical CLAUDE.md', async () => {
    await writeFile(path.join(repoPath, 'claude.md'), '# claude');
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(10);
    expect(
      result.findings.some(
        (f) => f.status === 'pass' && f.message === 'claude.md found',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (f) => f.status === 'warn' && /canonical CLAUDE\.md/.test(f.message),
      ),
    ).toBe(true);
  });

  it('detects .claude/CLAUDE.md as Claude-specific instructions', async () => {
    await mkdir(path.join(repoPath, '.claude'), { recursive: true });
    await writeFile(path.join(repoPath, '.claude', 'CLAUDE.md'), '# Claude');
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(10);
    expect(
      result.findings.some(
        (f) =>
          f.status === 'pass' && f.files?.includes('.claude/CLAUDE.md'),
      ),
    ).toBe(true);
  });

  it('detects .claude/claude.md as Claude-specific instructions', async () => {
    await mkdir(path.join(repoPath, '.claude'), { recursive: true });
    await writeFile(path.join(repoPath, '.claude', 'claude.md'), '# claude');
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(10);
    expect(
      result.findings.some(
        (f) =>
          f.status === 'pass' && f.files?.includes('.claude/claude.md'),
      ),
    ).toBe(true);
  });

  it('detects .claude/commands/*.md as Claude-related context', async () => {
    await mkdir(path.join(repoPath, '.claude', 'commands'), {
      recursive: true,
    });
    await writeFile(
      path.join(repoPath, '.claude', 'commands', 'review.md'),
      '# review',
    );
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(10);
    expect(
      result.findings.some(
        (f) =>
          f.status === 'pass' &&
          f.files?.some((file) => file.endsWith('commands/review.md')),
      ),
    ).toBe(true);
  });

  it('gives full score for AGENTS.md plus .claude/commands/review.md', async () => {
    await writeFile(
      path.join(repoPath, 'AGENTS.md'),
      '# Agents\nReal content.',
    );
    await mkdir(path.join(repoPath, '.claude', 'commands'), {
      recursive: true,
    });
    await writeFile(
      path.join(repoPath, '.claude', 'commands', 'review.md'),
      '# review',
    );
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(20);
  });

  it('gives full score for AGENTS.md plus lowercase claude.md and still warns', async () => {
    await writeFile(
      path.join(repoPath, 'AGENTS.md'),
      '# Agents\nReal content.',
    );
    await writeFile(path.join(repoPath, 'claude.md'), '# claude');
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(20);
    expect(
      result.findings.some(
        (f) => f.status === 'warn' && /canonical CLAUDE\.md/.test(f.message),
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
