import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  loadArkrc,
  resolveAuditRunOptions,
  resolveInitOptions,
  resolveGenerateOptions,
  ArkrcError,
} from '../src/config/loadArkrc.js';

describe('loadArkrc', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-arkrc-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('returns null when .arkrc is missing', async () => {
    expect(await loadArkrc(repoPath)).toBeNull();
  });

  it('loads valid .arkrc', async () => {
    await writeFile(
      path.join(repoPath, '.arkrc'),
      JSON.stringify({
        audit: { output: 'reports/audit.md', json: true },
        init: { force: false },
      }),
    );
    const config = await loadArkrc(repoPath);
    expect(config?.audit?.output).toBe('reports/audit.md');
    expect(config?.audit?.json).toBe(true);
  });

  it('throws ArkrcError on invalid JSON', async () => {
    await writeFile(path.join(repoPath, '.arkrc'), '{ not json');
    await expect(loadArkrc(repoPath)).rejects.toBeInstanceOf(ArkrcError);
  });

  it('throws ArkrcError on schema violation', async () => {
    await writeFile(
      path.join(repoPath, '.arkrc'),
      JSON.stringify({ audit: { json: 'yes' } }),
    );
    await expect(loadArkrc(repoPath)).rejects.toBeInstanceOf(ArkrcError);
  });
});

describe('resolve options', () => {
  const arkrc = {
    audit: {
      output: 'docs/from-arkrc.md',
      json: true,
      repoPath: './configured',
    },
    init: { force: true, repoPath: './configured' },
    generate: { force: true },
  };

  it('applies audit defaults from .arkrc', () => {
    const run = resolveAuditRunOptions('.', {}, arkrc);
    expect(run.repoPathArg).toBe('./configured');
    expect(run.json).toBe(true);
    expect(run.output).toBe('docs/from-arkrc.md');
  });

  it('CLI audit flags override .arkrc', () => {
    const run = resolveAuditRunOptions(
      '.',
      { json: false, output: 'cli.md' },
      arkrc,
    );
    expect(run.json).toBe(false);
    expect(run.output).toBe('cli.md');
  });

  it('explicit repo path ignores .arkrc repoPath', () => {
    const run = resolveAuditRunOptions('./other', {}, arkrc);
    expect(run.repoPathArg).toBe('./other');
  });

  it('merges init force with CLI precedence', () => {
    expect(resolveInitOptions('.', {}, arkrc).force).toBe(true);
    expect(resolveInitOptions('.', { force: false }, arkrc).force).toBe(false);
  });

  it('merges generate force with CLI precedence', () => {
    expect(resolveGenerateOptions('.', {}, arkrc).force).toBe(true);
    expect(resolveGenerateOptions('.', { force: false }, arkrc).force).toBe(
      false,
    );
  });
});
