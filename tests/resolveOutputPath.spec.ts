import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  resolveOutputPath,
  OutputPathError,
} from '../src/fs/resolveOutputPath.js';

const repo = path.resolve('/tmp/repo');

describe('resolveOutputPath', () => {
  it('resolves a relative path under the repository root', () => {
    expect(resolveOutputPath(repo, 'docs/report.md')).toBe(
      path.join(repo, 'docs/report.md'),
    );
  });

  it('normalises ".." segments that stay inside the repository', () => {
    expect(resolveOutputPath(repo, 'docs/../report.md')).toBe(
      path.join(repo, 'report.md'),
    );
  });

  it('accepts an absolute path that points inside the repository', () => {
    const inside = path.join(repo, 'out/report.md');
    expect(resolveOutputPath(repo, inside)).toBe(inside);
  });

  it('rejects a relative path that escapes the repository', () => {
    expect(() => resolveOutputPath(repo, '../../etc/report.md')).toThrow(
      OutputPathError,
    );
  });

  it('rejects an absolute path outside the repository', () => {
    expect(() => resolveOutputPath(repo, '/etc/report.md')).toThrow(
      OutputPathError,
    );
  });

  it('rejects a sibling directory with a shared name prefix', () => {
    expect(() => resolveOutputPath(repo, '../repo-evil/report.md')).toThrow(
      OutputPathError,
    );
  });

  it('rejects the repository root itself', () => {
    expect(() => resolveOutputPath(repo, '.')).toThrow(OutputPathError);
  });

  it('names the given, resolved and repo paths in the error', () => {
    try {
      resolveOutputPath(repo, '../../etc/report.md');
      expect.unreachable('should have thrown');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('../../etc/report.md');
      expect(message).toContain(path.resolve('/etc/report.md'));
      expect(message).toContain(repo);
      expect(message).toContain('--allow-outside');
    }
  });

  it('allows escaping paths when allowOutside is set', () => {
    expect(
      resolveOutputPath(repo, '../../etc/report.md', { allowOutside: true }),
    ).toBe(path.resolve('/etc/report.md'));
    expect(
      resolveOutputPath(repo, '/etc/report.md', { allowOutside: true }),
    ).toBe(path.resolve('/etc/report.md'));
  });
});
