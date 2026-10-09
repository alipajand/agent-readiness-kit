import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSafe } from '../src/fs/writeFileSafe.js';
import { findFiles } from '../src/fs/findFiles.js';
import { readTextFile } from '../src/fs/readTextFile.js';
import {
  OutputPathError,
  resolveOutputPath,
} from '../src/fs/resolveOutputPath.js';
import {
  appendHistory,
  HistoryWriteError,
  loadHistory,
} from '../src/audit/history.js';
import { loadArkrc } from '../src/config/loadArkrc.js';
import { checkAgentInstructions } from '../src/audit/checks/agentInstructions.js';
import { checkArchitecture } from '../src/audit/checks/architecture.js';
import { checkDependencies } from '../src/audit/checks/dependencies.js';
import { checkDocumentation } from '../src/audit/checks/documentation.js';
import { checkGitHygiene } from '../src/audit/checks/gitHygiene.js';
import { checkTesting } from '../src/audit/checks/testing.js';
import { runInit } from '../src/generate/initFiles.js';
import { generateGithub } from '../src/generate/githubFiles.js';
import { formatJunitReport } from '../src/report/junitReport.js';
import { formatMarkdownReport } from '../src/report/markdownReport.js';
import { formatTerminalReport } from '../src/report/terminalReport.js';
import { toSafeText } from '../src/report/safeText.js';
import type { AuditResult } from '../src/types.js';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
const cliPath = path.join(projectRoot, 'src/cli.ts');

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', cliPath, ...args],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    return { stdout, stderr, code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      code: e.code ?? 1,
    };
  }
}

async function exists(p: string): Promise<boolean> {
  return access(p).then(
    () => true,
    () => false,
  );
}

let root: string;
let repo: string;
let outside: string;

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'ark-sec-')));
  repo = path.join(root, 'repo');
  outside = path.join(root, 'outside');
  await mkdir(repo);
  await mkdir(outside);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('writeFileSafe', () => {
  it('never writes through an existing symlink, even with force', async () => {
    const target = path.join(outside, 'bashrc');
    await writeFile(target, 'keep');
    await symlink(target, path.join(repo, 'AGENTS.md'));

    const result = await writeFileSafe(path.join(repo, 'AGENTS.md'), 'x', {
      force: true,
      root: repo,
    });
    expect(result).toMatchObject({ status: 'refused', reason: 'symlink' });
    expect(await readFile(target, 'utf8')).toBe('keep');
  });

  it('treats a dangling symlink as existing instead of creating its target', async () => {
    const target = path.join(outside, 'created-by-link');
    await symlink(target, path.join(repo, 'AGENTS.md'));

    const result = await writeFileSafe(path.join(repo, 'AGENTS.md'), 'x', {
      root: repo,
    });
    expect(result.status).toBe('skipped');
    expect(await exists(target)).toBe(false);
  });

  it('refuses writes that escape the root through a symlinked directory', async () => {
    await symlink(outside, path.join(repo, '.github'));

    const result = await writeFileSafe(
      path.join(repo, '.github', 'workflows', 'ci.yml'),
      'x',
      { root: repo },
    );
    expect(result).toMatchObject({ status: 'refused', reason: 'outside-repo' });
    expect(await exists(path.join(outside, 'workflows'))).toBe(false);
  });
});

describe('generators', () => {
  it('init --force does not overwrite files a symlink points at', async () => {
    const target = path.join(outside, 'important.md');
    await writeFile(target, 'keep');
    await symlink(target, path.join(repo, 'AGENTS.md'));

    const results = await runInit({ repoPath: repo, force: true });
    expect(results.find((r) => r.path.endsWith('AGENTS.md'))?.status).toBe(
      'refused',
    );
    expect(await readFile(target, 'utf8')).toBe('keep');
  });

  it('generate github does not follow a symlinked .github directory', async () => {
    await symlink(outside, path.join(repo, '.github'));
    const results = await generateGithub({ repoPath: repo, force: true });
    expect(results.every((r) => r.status === 'refused')).toBe(true);
  });
});

describe('resolveOutputPath', () => {
  it('rejects a path that escapes through a symlinked directory', async () => {
    await symlink(outside, path.join(repo, 'docs'));
    expect(() => resolveOutputPath(repo, 'docs/report.md')).toThrow(
      OutputPathError,
    );
  });

  it('accepts file names that merely start with two dots', () => {
    expect(resolveOutputPath(repo, '..notes.md')).toBe(
      path.join(repo, '..notes.md'),
    );
  });
});

describe('findFiles', () => {
  it('does not traverse symlinked directories', async () => {
    await writeFile(path.join(outside, 'secret.md'), 'x');
    await symlink(outside, path.join(repo, 'docs'));
    expect(await findFiles(repo, '**/*.md')).toEqual([]);
  });

  it('does not list files under a symlinked directory named in the pattern', async () => {
    await mkdir(path.join(outside, 'workflows'));
    await writeFile(path.join(outside, 'workflows', 'ci.yml'), 'x');
    await symlink(outside, path.join(repo, '.github'));
    expect(await findFiles(repo, '.github/workflows/*.yml')).toEqual([]);
  });

  it('keeps symlinked files whose target is inside the repo', async () => {
    await writeFile(path.join(repo, 'AGENTS.md'), '# Agents');
    await symlink('AGENTS.md', path.join(repo, 'CLAUDE.md'));
    const found = await findFiles(repo, '*.md');
    expect(found.map((f) => path.basename(f))).toEqual([
      'AGENTS.md',
      'CLAUDE.md',
    ]);
  });

  it('drops symlinked files that point outside the repo', async () => {
    await writeFile(path.join(outside, 'x.md'), 'x');
    await symlink(path.join(outside, 'x.md'), path.join(repo, 'x.md'));
    expect(await findFiles(repo, '*.md')).toEqual([]);
  });
});

describe('readTextFile', () => {
  it('returns null for directories and oversized files', async () => {
    await writeFile(path.join(repo, 'big.md'), 'x'.repeat(64));
    expect(await readTextFile(repo)).toBeNull();
    expect(await readTextFile(path.join(repo, 'big.md'), 32)).toBeNull();
    expect(await readTextFile(path.join(repo, 'big.md'), 64)).toBe(
      'x'.repeat(64),
    );
  });
});

describe('score history', () => {
  const result: AuditResult = {
    repoPath: '/r',
    score: 50,
    categories: [],
    missing: [],
    recommendations: [],
  };

  it('ignores malformed history instead of crashing', async () => {
    await writeFile(
      path.join(repo, '.ark-history.json'),
      JSON.stringify({ entries: 'nope' }),
    );
    expect(await loadHistory(repo)).toEqual({ entries: [] });
    await writeFile(
      path.join(repo, '.ark-history.json'),
      JSON.stringify({ entries: [{ score: 'x' }, null] }),
    );
    expect(await loadHistory(repo)).toEqual({ entries: [] });
  });

  it('refuses to write history through a symlink', async () => {
    const target = path.join(outside, 'authorized_keys');
    await writeFile(target, 'keep');
    await symlink(target, path.join(repo, '.ark-history.json'));

    await expect(appendHistory(repo, result)).rejects.toThrow(
      HistoryWriteError,
    );
    expect(await readFile(target, 'utf8')).toBe('keep');
  });
});

describe('.arkrc confinement', () => {
  it('rejects repoPath values that leave the repository', async () => {
    for (const key of ['audit', 'init', 'generate']) {
      await writeFile(
        path.join(repo, '.arkrc'),
        JSON.stringify({ [key]: { repoPath: '../outside' } }),
      );
      await expect(loadArkrc(repo)).rejects.toThrow(/must stay inside/);
    }
  });

  it('rejects an audit.output that leaves the repository', async () => {
    await writeFile(
      path.join(repo, '.arkrc'),
      JSON.stringify({ audit: { output: path.join(outside, 'r.md') } }),
    );
    await expect(loadArkrc(repo)).rejects.toThrow(/audit.output/);
  });

  it('rejects a .arkrc that is not a regular file', async () => {
    await mkdir(path.join(repo, '.arkrc'));
    await expect(loadArkrc(repo)).rejects.toThrow(/regular file/);
  });
});

describe('report escaping', () => {
  const hostile: AuditResult = {
    repoPath: '/r',
    score: 10,
    categories: [
      {
        id: 'a',
        label: 'Alpha',
        score: 1,
        maxScore: 20,
        findings: [
          {
            status: 'fail',
            message: 'Placeholder in <!-- hidden --> \u001b[2J',
            files: ['docs/`x`.md'],
          },
        ],
      },
    ],
    missing: ['<img src=x>'],
    recommendations: [],
  };

  it('escapes HTML and keeps file names in fence-safe code spans in Markdown', () => {
    const md = formatMarkdownReport(hostile);
    expect(md).not.toContain('<!--');
    expect(md).not.toContain('<img');
    expect(md).toContain('``docs/`x`.md``');
  });

  it('strips terminal escape sequences from terminal output', () => {
    expect(formatTerminalReport(hostile)).not.toContain('\u001b[2J');
  });

  it('shows invisible characters as code points', () => {
    expect(toSafeText(`a${String.fromCodePoint(0x202e)}b`)).toBe('a<U+202E>b');
  });
});

describe('ark CLI', () => {
  it('audit keeps working when .ark-history.json is a symlink', async () => {
    const target = path.join(outside, 'history-target');
    await writeFile(target, 'keep');
    await symlink(target, path.join(repo, '.ark-history.json'));

    const { code, stderr } = await runCli(['audit', repo]);
    expect(code).toBe(0);
    expect(stderr).toContain('Refusing to write .ark-history.json');
    expect(await readFile(target, 'utf8')).toBe('keep');
  });

  it('does not let --allow-outside widen an output path from .arkrc', async () => {
    await writeFile(
      path.join(repo, '.arkrc'),
      JSON.stringify({ audit: { output: 'reports/r.md' } }),
    );
    await symlink(outside, path.join(repo, 'reports'));

    const { code } = await runCli([
      'audit',
      repo,
      '--allow-outside',
      '--no-history',
    ]);
    expect(code).toBe(1);
    expect(await exists(path.join(outside, 'r.md'))).toBe(false);
  });

  it('refuses to write a report through a symlink', async () => {
    const target = path.join(repo, 'notes.md');
    await writeFile(target, 'keep');
    await symlink(target, path.join(repo, 'report.md'));

    const { code, stderr } = await runCli([
      'audit',
      repo,
      '--output',
      'report.md',
      '--no-history',
    ]);
    expect(code).toBe(1);
    expect(stderr).toContain('symbolic link');
    expect(await readFile(target, 'utf8')).toBe('keep');
  });
});

describe('ark audit --min-score', () => {
  it('exits 1 when the score is below the minimum', async () => {
    const { code, stderr } = await runCli([
      'audit',
      repo,
      '--no-history',
      '--min-score',
      '90',
    ]);
    expect(code).toBe(1);
    expect(stderr).toContain('is below --min-score 90');
  });

  it('exits 0 when the score meets the minimum', async () => {
    const { code } = await runCli([
      'audit',
      repo,
      '--no-history',
      '--min-score',
      '0',
    ]);
    expect(code).toBe(0);
  });

  it('rejects an invalid minimum', async () => {
    const { code, stderr } = await runCli([
      'audit',
      repo,
      '--min-score',
      '101',
    ]);
    expect(code).toBe(1);
    expect(stderr).toContain('integer from 0 to 100');
  });

  it('reads audit.minScore from .arkrc', async () => {
    await writeFile(
      path.join(repo, '.arkrc'),
      JSON.stringify({ audit: { minScore: 95 } }),
    );
    const { code } = await runCli(['audit', repo, '--no-history']);
    expect(code).toBe(1);
  });
});

describe('library entry point', () => {
  it('exports the audit engine and formatters', async () => {
    const api = await import('../src/index.js');
    expect(typeof api.auditRepo).toBe('function');
    expect(typeof api.formatMarkdownReport).toBe('function');
    expect(api.ALL_CHECK_IDS).toContain('agent-instructions');
  });
});

describe('findFiles with a file where a directory pattern expects one', () => {
  it('does not throw when .clinerules is a file', async () => {
    await writeFile(path.join(repo, '.clinerules'), 'rules');
    const found = await findFiles(repo, ['.clinerules', '.clinerules/**/*.md']);
    expect(found.map((f) => path.basename(f))).toEqual(['.clinerules']);
  });
});

describe('root files behind symlinks', () => {
  const checks = [
    checkTesting,
    checkDependencies,
    checkArchitecture,
    checkGitHygiene,
  ];

  it('ignores a package.json that links outside the repository', async () => {
    const target = path.join(outside, 'package.json');
    await writeFile(
      target,
      JSON.stringify({
        scripts: { test: 'vitest' },
        engines: { node: '>=20' },
        workspaces: ['packages/*'],
      }),
    );
    await symlink(target, path.join(repo, 'package.json'));
    const linked = await Promise.all(checks.map((check) => check(repo)));

    await rm(path.join(repo, 'package.json'));
    const absent = await Promise.all(checks.map((check) => check(repo)));
    expect(linked).toEqual(absent);
  });

  it('ignores a .gitignore that links outside the repository', async () => {
    const target = path.join(outside, 'gitignore');
    await writeFile(target, 'node_modules\n.env\ndist\ncoverage\n');
    await symlink(target, path.join(repo, '.gitignore'));
    const linked = await checkGitHygiene(repo);

    await rm(path.join(repo, '.gitignore'));
    expect(linked).toEqual(await checkGitHygiene(repo));
    expect(linked.findings).toContainEqual({
      status: 'fail',
      message: 'No .gitignore found',
    });
  });

  it('does not read README.md contents through an outside link', async () => {
    const target = path.join(outside, 'README.md');
    await writeFile(target, 'install usage setup license\n'.repeat(30));
    await symlink(target, path.join(repo, 'README.md'));
    const linked = await checkDocumentation(repo);

    await rm(path.join(repo, 'README.md'));
    expect(linked).toEqual(await checkDocumentation(repo));
  });

  it('does not report placeholders from files that link outside', async () => {
    await writeFile(path.join(outside, 'notes.md'), '<!-- Describe this -->');
    await symlink(path.join(outside, 'notes.md'), path.join(repo, 'AGENTS.md'));
    await mkdir(path.join(repo, 'docs'));
    await symlink(
      path.join(outside, 'notes.md'),
      path.join(repo, 'docs', 'ARCHITECTURE.md'),
    );
    const results = [
      await checkAgentInstructions(repo),
      await checkArchitecture(repo),
    ];
    const messages = results.flatMap((r) => r.findings.map((f) => f.message));
    expect(messages.some((m) => m.includes('placeholder'))).toBe(false);
  });

  it('still reads root files that link inside the repository', async () => {
    await mkdir(path.join(repo, 'config'));
    await writeFile(
      path.join(repo, 'config', 'package.json'),
      JSON.stringify({ workspaces: ['packages/*'] }),
    );
    await symlink('config/package.json', path.join(repo, 'package.json'));
    await writeFile(path.join(repo, 'config', 'gitignore'), 'node_modules\n');
    await symlink('config/gitignore', path.join(repo, '.gitignore'));

    const architecture = await checkArchitecture(repo);
    expect(architecture.findings.map((f) => f.message)).toContain(
      'pnpm/npm workspace configured in package.json',
    );
    const git = await checkGitHygiene(repo);
    expect(git.findings.map((f) => f.message)).not.toContain(
      'No .gitignore found',
    );
  });
});

describe('JUnit report', () => {
  it('stays well-formed when messages carry control characters', () => {
    const result: AuditResult = {
      repoPath: repo,
      score: 0,
      categories: [
        {
          id: 'testing',
          label: 'Tests\x00',
          score: 0,
          maxScore: 10,
          findings: [
            {
              status: 'fail',
              message: 'bad\x0bname\x1b[31m\uFFFE\uD800 <&>',
              files: ['a\x0cb.ts'],
            },
          ],
        },
      ],
      missing: [],
      recommendations: [],
    };
    const xml = formatJunitReport(result);
    // Characters XML 1.0 forbids (tab, LF, and CR are allowed).
    expect(xml).not.toMatch(
      /[\x00-\x08\x0b\x0c\x0e-\x1f\uFFFE\uFFFF]|[\uD800-\uDFFF]/u,
    );
    expect(xml).toContain('name="bad name [31m\uFFFD\uFFFD &lt;&amp;&gt;"');
  });
});
