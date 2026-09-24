import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkAgentInstructions } from '../src/audit/checks/agentInstructions.js';

describe('checkAgentInstructions — other agent tools', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-tools-'));
    await writeFile(
      path.join(repoPath, 'AGENTS.md'),
      '# Agents\nReal content.',
    );
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  async function write(rel: string): Promise<void> {
    const full = path.join(repoPath, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, '# rules');
  }

  it.each([
    ['GEMINI.md', 'Gemini'],
    ['.gemini/styleguide.md', 'Gemini'],
    ['AGENT.md', 'Amp'],
    ['.windsurfrules', 'Windsurf'],
    ['.windsurf/rules/style.md', 'Windsurf'],
    ['.clinerules', 'Cline'],
    ['.clinerules/01-style.md', 'Cline'],
    ['.roo/rules/style.md', 'Roo Code'],
    ['.kiro/steering/tech.md', 'Kiro'],
    ['.junie/guidelines.md', 'Junie'],
    ['.augment-guidelines', 'Augment'],
    ['.continue/rules/review.md', 'Continue'],
    ['.goosehints', 'Goose'],
    ['.github/instructions/tests.instructions.md', 'Copilot path-specific'],
  ])('counts %s as %s instructions for full score', async (rel, label) => {
    await write(rel);
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(20);
    expect(result.findings.map((f) => f.message)).toContain(
      `${label} instructions found`,
    );
  });

  it('does not count unrelated markdown', async () => {
    await write('docs/gemini-notes.md');
    const result = await checkAgentInstructions(repoPath);
    expect(result.score).toBe(15);
  });
});
