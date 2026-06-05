import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateGithub } from '../src/generate/githubFiles.js';

describe('generateGithub', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-github-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('creates all five GitHub scaffolding files', async () => {
    const results = await generateGithub({ repoPath });
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.status === 'created')).toBe(true);

    for (const rel of [
      path.join('.github', 'workflows', 'ci.yml'),
      path.join('.github', 'pull_request_template.md'),
      path.join('.github', 'dependabot.yml'),
      path.join('.github', 'ISSUE_TEMPLATE', 'bug_report.md'),
      path.join('.github', 'ISSUE_TEMPLATE', 'feature_request.md'),
    ]) {
      await access(path.join(repoPath, rel), constants.F_OK);
    }
  });

  it('skips existing files without force', async () => {
    await generateGithub({ repoPath });
    const results = await generateGithub({ repoPath });
    expect(results.every((r) => r.status === 'skipped')).toBe(true);
  });

  it('overwrites existing files with force', async () => {
    await generateGithub({ repoPath });
    const results = await generateGithub({ repoPath, force: true });
    expect(results.every((r) => r.status === 'overwritten')).toBe(true);
  });
});
