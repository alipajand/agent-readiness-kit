import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixRepo } from '../src/generate/fixRepo.js';
import type { AuditResult } from '../src/types.js';

function makeAudit(failMessages: string[]): AuditResult {
  return {
    repoPath: '/tmp/x',
    score: 0,
    categories: [
      {
        id: 'agent-instructions',
        label: 'Agent instructions',
        score: 0,
        maxScore: 20,
        findings: failMessages.map((message) => ({
          status: 'fail' as const,
          message,
        })),
      },
    ],
    missing: [],
    recommendations: [],
  };
}

describe('fixRepo', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-fix-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scaffolds init files when AGENTS.md is missing', async () => {
    const results = await fixRepo(makeAudit(['AGENTS.md not found']), {
      repoPath,
    });
    expect(results.length).toBeGreaterThan(0);
    await access(path.join(repoPath, 'AGENTS.md'), constants.F_OK);
  });

  it('scaffolds copilot instructions when agent instructions are absent', async () => {
    const results = await fixRepo(
      makeAudit(['No agent instruction files detected']),
      { repoPath },
    );
    expect(results.some((r) => r.path.includes('copilot-instructions'))).toBe(
      true,
    );
  });

  it('scaffolds GitHub workflow files when CI workflow is missing', async () => {
    const results = await fixRepo(makeAudit(['No CI workflow present']), {
      repoPath,
    });
    expect(results.some((r) => r.path.includes('ci.yml'))).toBe(true);
  });

  it('returns no results when there are no actionable failures', async () => {
    const results = await fixRepo(makeAudit(['Some unrelated failure']), {
      repoPath,
    });
    expect(results).toEqual([]);
  });

  it('deduplicates write results by path', async () => {
    const results = await fixRepo(
      makeAudit(['AGENTS.md not found', 'No agent instruction files detected']),
      { repoPath },
    );
    const paths = results.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
