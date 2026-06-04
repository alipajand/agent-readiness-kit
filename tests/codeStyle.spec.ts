import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkCodeStyle } from '../src/audit/checks/codeStyle.js';

describe('checkCodeStyle', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-style-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('scores 0 and fails when no style tooling exists', async () => {
    const result = await checkCodeStyle(repoPath);
    expect(result.score).toBe(0);
    expect(result.findings.some((f) => f.status === 'fail')).toBe(true);
  });

  it('awards points for eslint.config.js', async () => {
    await writeFile(path.join(repoPath, 'eslint.config.js'), 'export default [];\n');
    const result = await checkCodeStyle(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.findings.some((f) => f.message.includes('ESLint'))).toBe(true);
  });

  it('awards points for .prettierrc', async () => {
    await writeFile(path.join(repoPath, '.prettierrc'), '{"semi":false}\n');
    const result = await checkCodeStyle(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.findings.some((f) => f.message.includes('Prettier'))).toBe(true);
  });

  it('awards points for .editorconfig', async () => {
    await writeFile(path.join(repoPath, '.editorconfig'), '[*]\nindent_style = space\n');
    const result = await checkCodeStyle(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(2);
    expect(result.findings.some((f) => f.message.includes('.editorconfig'))).toBe(true);
  });

  it('full score with eslint + prettier + editorconfig', async () => {
    await writeFile(path.join(repoPath, 'eslint.config.js'), '');
    await writeFile(path.join(repoPath, '.prettierrc'), '{}');
    await writeFile(path.join(repoPath, '.editorconfig'), '');
    const result = await checkCodeStyle(repoPath);
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.score).toBeLessThanOrEqual(result.maxScore);
  });

  it('biome config counts as lint + format', async () => {
    await writeFile(path.join(repoPath, 'biome.json'), '{}');
    const result = await checkCodeStyle(repoPath);
    expect(result.findings.some((f) => f.message.includes('Biome'))).toBe(true);
  });
});
