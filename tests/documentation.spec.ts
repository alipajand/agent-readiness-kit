import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkDocumentation } from '../src/audit/checks/documentation.js';

const RICH_README = `# My Project

## Overview

A great project for everyone.

## Getting started

Run \`npm install\` to install dependencies.

## Usage

Call the CLI with \`npx myproject\`.

## Development

Clone, install, and run \`npm run dev\`.

## Contributing

See CONTRIBUTING.md for guidelines.

## License

MIT
`;

describe('checkDocumentation', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-docs-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 when no docs exist', async () => {
    const result = await checkDocumentation(repoPath);
    expect(result.score).toBe(0);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('awards 4 points for a rich README', async () => {
    await writeFile(path.join(repoPath, 'README.md'), RICH_README);
    const result = await checkDocumentation(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(4);
    expect(
      result.findings.some((f) => f.status === 'pass' && f.message.includes('README')),
    ).toBe(true);
  });

  it('awards fewer points for a minimal README', async () => {
    await writeFile(path.join(repoPath, 'README.md'), '# Hello\n');
    const result = await checkDocumentation(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThan(4);
  });

  it('awards points for CHANGELOG.md', async () => {
    await writeFile(path.join(repoPath, 'README.md'), RICH_README);
    await writeFile(path.join(repoPath, 'CHANGELOG.md'), '# Changelog\n');
    const result = await checkDocumentation(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(7);
    expect(result.findings.some((f) => f.message.includes('CHANGELOG'))).toBe(true);
  });

  it('awards points for CONTRIBUTING.md', async () => {
    await writeFile(path.join(repoPath, 'README.md'), RICH_README);
    await writeFile(path.join(repoPath, 'CONTRIBUTING.md'), '# Contributing\n');
    const result = await checkDocumentation(repoPath);
    expect(result.findings.some((f) => f.message.includes('CONTRIBUTING'))).toBe(true);
  });

  it('caps score at maxScore', async () => {
    await writeFile(path.join(repoPath, 'README.md'), RICH_README);
    await writeFile(path.join(repoPath, 'CHANGELOG.md'), '# Changelog\n');
    await writeFile(path.join(repoPath, 'CONTRIBUTING.md'), '# Contributing\n');
    await writeFile(path.join(repoPath, 'CODE_OF_CONDUCT.md'), '# CoC\n');
    const result = await checkDocumentation(repoPath);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
    expect(result.maxScore).toBe(10);
  });
});
