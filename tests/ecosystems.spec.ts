import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  describeEcosystems,
  detectEcosystems,
  proportionalPoints,
  scoreEcosystemSignal,
  type DetectedEcosystems,
} from '../src/audit/ecosystems.js';
import {
  justfileRecipes,
  makefileTargets,
  noxSessions,
  pyprojectTasks,
  readTaskSources,
  taskfileTasks,
  tomlTables,
  toxEnvironments,
} from '../src/audit/projectFiles.js';
import {
  findWorkspaceConfig,
  goModRequires,
  requirementsArePinned,
} from '../src/audit/checks/dependencies.js';
import { checkCodeStyle } from '../src/audit/checks/codeStyle.js';
import { commandFillsRole } from '../src/audit/checks/workflow.js';
import { gitignoreItems } from '../src/audit/checks/gitHygiene.js';
import { toAuditJson } from '../src/report/jsonReport.js';
import { formatMarkdownReport } from '../src/report/markdownReport.js';
import { formatHtmlReport } from '../src/report/htmlReport.js';
import { formatTerminalReport } from '../src/report/terminalReport.js';
import { formatSarifReport } from '../src/report/sarifReport.js';
import type { AuditResult } from '../src/types.js';

async function put(root: string, rel: string, content = ''): Promise<void> {
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await writeFile(path.join(root, rel), content);
}

describe('detectEcosystems', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-detect-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('detects nothing in an empty repository', async () => {
    expect(await detectEcosystems(repoPath)).toEqual({
      ids: [],
      manifests: {},
    });
  });

  it.each([
    ['node', 'package.json'],
    ['node', 'yarn.lock'],
    ['python', 'pyproject.toml'],
    ['python', 'setup.py'],
    ['python', 'Pipfile'],
    ['python', 'requirements.txt'],
    ['python', 'requirements-dev.txt'],
    ['go', 'go.mod'],
    ['rust', 'Cargo.toml'],
  ])('detects %s from %s', async (id, rel) => {
    await put(repoPath, rel);
    const detected = await detectEcosystems(repoPath);
    expect(detected.ids).toEqual([id]);
    expect(detected.manifests[id as 'node']).toEqual([rel]);
  });

  it('detects nested manifests of a polyglot repository in a fixed order', async () => {
    await put(repoPath, 'services/api/go.mod');
    await put(repoPath, 'apps/web/package.json');
    await put(repoPath, 'ml/pyproject.toml');
    expect((await detectEcosystems(repoPath)).ids).toEqual([
      'node',
      'python',
      'go',
    ]);
  });

  it('ignores a nested requirements.txt such as docs/requirements.txt', async () => {
    await put(repoPath, 'package.json');
    await put(repoPath, 'docs/requirements.txt', 'mkdocs==1.6.0\n');
    expect((await detectEcosystems(repoPath)).ids).toEqual(['node']);
  });

  it('ignores manifests in dependency, fixture, and example directories', async () => {
    for (const rel of [
      'node_modules/a/package.json',
      'vendor/x/go.mod',
      'tests/fixtures/app/Cargo.toml',
      'examples/demo/package.json',
      '.venv/lib/pyproject.toml',
      'target/package/Cargo.toml',
    ]) {
      await put(repoPath, rel);
    }
    expect((await detectEcosystems(repoPath)).ids).toEqual([]);
  });

  it('does not look deeper than the manifest scan depth', async () => {
    await put(repoPath, 'a/b/c/d/e/package.json');
    expect((await detectEcosystems(repoPath)).ids).toEqual([]);
  });
});

describe('proportionalPoints and scoreEcosystemSignal', () => {
  it('floors the share of satisfied ecosystems', () => {
    expect(proportionalPoints(3, 1, 1)).toBe(3);
    expect(proportionalPoints(3, 1, 2)).toBe(1);
    expect(proportionalPoints(3, 2, 3)).toBe(2);
    expect(proportionalPoints(2, 1, 2)).toBe(1);
    expect(proportionalPoints(4, 1, 3)).toBe(1);
    expect(proportionalPoints(3, 0, 2)).toBe(0);
  });

  it('never divides by zero', () => {
    expect(proportionalPoints(3, 0, 0)).toBe(0);
  });

  const none: DetectedEcosystems = { ids: [], manifests: {} };
  const two: DetectedEcosystems = { ids: ['node', 'go'], manifests: {} };

  it('awards nothing for an unknown stack without evidence', async () => {
    const outcome = await scoreEcosystemSignal(
      none,
      3,
      async () => ({ satisfied: true }),
      async () => ({ satisfied: false, missingMessage: 'none' }),
    );
    expect(outcome.points).toBe(0);
    expect(outcome.applicable).toBe(1);
  });

  it('awards full points for an unknown stack only with evidence', async () => {
    const outcome = await scoreEcosystemSignal(
      none,
      3,
      async () => ({ satisfied: false }),
      async () => ({ satisfied: true }),
    );
    expect(outcome.points).toBe(3);
  });

  it('evaluates every detected ecosystem', async () => {
    const outcome = await scoreEcosystemSignal(
      two,
      3,
      async (id) => ({ satisfied: id === 'go' }),
      async () => ({ satisfied: true }),
    );
    expect(outcome.results.map((r) => r.id)).toEqual(['node', 'go']);
    expect(outcome.satisfied).toBe(1);
    expect(outcome.points).toBe(1);
  });
});

describe('task runner parsers', () => {
  it('reads Makefile targets, skipping variables, recipes, and pattern rules', () => {
    const makefile = [
      'GO ?= go',
      'VERSION := 1.0',
      '.PHONY: build test',
      'build: deps',
      '\tgo build ./...',
      'test lint:',
      '\tgo test ./...',
      '%.o: %.c',
      '# fmt: commented out',
      'fmt::',
      '\tgofmt -w .',
    ].join('\n');
    expect(makefileTargets(makefile)).toEqual(['build', 'test', 'lint', 'fmt']);
  });

  it('reads justfile recipes, skipping settings and assignments', () => {
    const justfile = [
      'set shell := ["bash", "-c"]',
      'version := "1.0"',
      'alias t := test',
      '',
      'default: test',
      '',
      '@test filter="":',
      '    cargo test {{filter}}',
      'lint:',
      '    cargo clippy',
    ].join('\n');
    expect(justfileRecipes(justfile)).toEqual(['default', 'test', 'lint']);
  });

  it('reads Taskfile task names', () => {
    const taskfile = [
      "version: '3'",
      'vars:',
      '  NAME: x',
      'tasks:',
      '  build:',
      '    cmds:',
      '      - go build ./...',
      '  test:unit:',
      '    cmds: [go test ./...]',
      '  "lint":',
      '    cmds: [golangci-lint run]',
    ].join('\n');
    expect(taskfileTasks(taskfile)).toEqual(['build', 'test:unit', 'lint']);
  });

  it('reads poe, pdm, hatch, and taskipy tasks from pyproject.toml', () => {
    const tables = tomlTables(
      [
        '[project]',
        'name = "x"',
        '[tool.poe.tasks]',
        'test = "pytest"',
        '_private = "x"',
        '[tool.poe.tasks.lint]',
        'cmd = "ruff check ."',
        '[tool.pdm.scripts]',
        'fmt = "ruff format ."',
        '[tool.hatch.envs.default.scripts]',
        'typecheck = "mypy src"',
        '[tool.taskipy.tasks]',
        'serve = "uvicorn app:app"',
      ].join('\n'),
    );
    expect(pyprojectTasks(tables).sort()).toEqual(
      ['fmt', 'lint', 'serve', 'test', 'typecheck'].sort(),
    );
  });

  it('maps tox environments and nox sessions', () => {
    expect(
      toxEnvironments('[tox]\nenvlist = py312\n[testenv]\n[testenv:lint]\n'),
    ).toEqual(['test', 'lint']);
    expect(
      noxSessions(
        'import nox\n\n@nox.session(python=["3.12"])\ndef tests(session):\n    pass\n\n@nox.session\n@nox.parametrize("x", [1])\ndef lint(session, x):\n    pass\n',
      ),
    ).toEqual(['tests', 'lint']);
  });

  it('collects TOML table keys', () => {
    const tables = tomlTables(
      'top = 1\n[tool.ruff]\nline-length = 100\n[[tool.uv.index]]\nname = "x"\n',
    );
    expect(tables.get('')).toEqual(['top']);
    expect(tables.get('tool.ruff')).toEqual(['line-length']);
    expect(tables.has('tool.uv.index')).toBe(true);
  });
});

describe('role mapping', () => {
  it('keeps exact names for package.json scripts', () => {
    expect(commandFillsRole('package.json', 'test', 'test')).toBe(true);
    expect(commandFillsRole('package.json', 'test:unit', 'test')).toBe(false);
    expect(commandFillsRole('package.json', 'fmt', 'format')).toBe(false);
    expect(commandFillsRole('web/package.json', 'start', 'dev')).toBe(false);
  });

  it('accepts common aliases in other task runners', () => {
    expect(commandFillsRole('Makefile', 'fmt', 'format')).toBe(true);
    expect(commandFillsRole('Makefile', 'vet', 'lint')).toBe(true);
    expect(commandFillsRole('Makefile', 'test-unit', 'test')).toBe(true);
    expect(commandFillsRole('justfile', 'mypy', 'typecheck')).toBe(true);
    expect(commandFillsRole('Makefile', 'testdata', 'test')).toBe(false);
    expect(commandFillsRole('Makefile', 'start-db', 'dev')).toBe(false);
  });
});

describe('lockfile helpers', () => {
  it('treats requirements.txt as a lock only when every line is pinned', () => {
    expect(requirementsArePinned('requests==2.32.3\nidna==3.7\n')).toBe(true);
    expect(
      requirementsArePinned(
        '# compiled\nrequests==2.32.3 \\\n    --hash=sha256:abc\n-r base.txt\n',
      ),
    ).toBe(true);
    expect(requirementsArePinned('requests>=2\n')).toBe(false);
    expect(requirementsArePinned('requests==2.32.3\nflask\n')).toBe(false);
    expect(requirementsArePinned('requests!=2.0\n')).toBe(false);
    expect(requirementsArePinned('# empty\n')).toBe(false);
  });

  it('detects go.mod require directives', () => {
    expect(goModRequires('module x\n\ngo 1.22\n')).toBe(false);
    expect(goModRequires('module x\n\nrequire github.com/a/b v1.0.0\n')).toBe(
      true,
    );
    expect(goModRequires('module x\n\nrequire (\n\ta v1\n)\n')).toBe(true);
  });
});

describe('gitignoreItems', () => {
  it('keeps the original Node.js entries for Node.js and unknown stacks', () => {
    const labels = (ids: Parameters<typeof gitignoreItems>[0]) =>
      gitignoreItems(ids).map((i) => i.label);
    expect(labels(['node'])).toEqual([
      'node_modules',
      'dist',
      '.env',
      '.DS_Store',
    ]);
    expect(labels([])).toEqual(labels(['node']));
    expect(labels(['go'])).toEqual([
      '.env',
      '.DS_Store',
      'Go binaries',
      'Go coverage output',
    ]);
    expect(labels(['node', 'python'])).toHaveLength(6);
  });
});

describe('reports with ecosystems', () => {
  const base: AuditResult = {
    repoPath: '/tmp/x',
    score: 20,
    categories: [
      {
        id: 'testing',
        label: 'Testing and validation',
        score: 5,
        maxScore: 15,
        findings: [{ status: 'pass', message: 'Test files found (1): Go' }],
      },
    ],
    missing: [],
    recommendations: [],
  };

  it('adds ecosystems to JSON without changing the other fields', () => {
    const json = toAuditJson({ ...base, ecosystems: ['go'] });
    expect(json.ecosystems).toEqual(['go']);
    expect(Object.keys(json)).toEqual([
      'repoPath',
      'score',
      'ecosystems',
      'categories',
      'missing',
      'recommendations',
    ]);
    expect(Object.keys(json.categories[0])).toEqual([
      'id',
      'label',
      'score',
      'maxScore',
      'findings',
    ]);
  });

  it('omits ecosystems for results from older versions', () => {
    expect('ecosystems' in toAuditJson(base)).toBe(false);
    expect(formatMarkdownReport(base)).not.toContain('Ecosystems');
    expect(formatHtmlReport(base)).not.toContain('Ecosystems');
    expect(formatTerminalReport(base)).not.toContain('Ecosystems');
  });

  it('shows detected ecosystems in Markdown, HTML, and terminal reports', () => {
    const result = { ...base, ecosystems: ['node', 'python'] };
    expect(formatMarkdownReport(result)).toContain(
      '**Ecosystems:** Node.js, Python',
    );
    expect(formatHtmlReport(result)).toContain('Ecosystems: Node.js, Python');
    expect(formatTerminalReport(result)).toContain(
      'Ecosystems: Node.js, Python',
    );
    expect(formatMarkdownReport({ ...base, ecosystems: [] })).toContain(
      '**Ecosystems:** none detected',
    );
  });

  it('escapes unknown ecosystem ids loaded from JSON', () => {
    const result = { ...base, ecosystems: ['<script>x</script>'] };
    expect(formatHtmlReport(result)).not.toContain('<script>x</script>');
    expect(describeEcosystems(['go', 'zig'])).toBe('Go, zig');
  });

  it('keeps SARIF rule ids keyed by category', () => {
    const result: AuditResult = {
      ...base,
      ecosystems: ['go'],
      categories: [
        {
          ...base.categories[0],
          findings: [
            { status: 'warn', message: 'No Go tests for go test to run' },
          ],
        },
      ],
    };
    const sarif = JSON.parse(formatSarifReport(result)) as {
      runs: Array<{ results: Array<{ ruleId: string }> }>;
    };
    expect(sarif.runs[0].results.map((r) => r.ruleId)).toEqual(['testing']);
  });
});

describe('untrusted project files', () => {
  let repoPath: string;
  let outside: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-untrusted-'));
    outside = await mkdtemp(path.join(tmpdir(), 'ark-outside-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it('parses pathological lines in linear time', () => {
    const spaces = ' '.repeat(200_000);
    const started = Date.now();
    tomlTables(`[${spaces}x\n[a${spaces}.${spaces}b]\n`);
    makefileTargets(`a${spaces}b\n`);
    justfileRecipes(`a${spaces}b\n`);
    noxSessions('@nox.session\n'.repeat(50_000));
    goModRequires('\n'.repeat(200_000));
    requirementsArePinned(`pkg${spaces}\n`);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('keeps only plain task names from file contents', async () => {
    await put(
      repoPath,
      'tox.ini',
      '[testenv]\n[testenv:test-[x](http://example.com)]\n[testenv:lint]\n',
    );
    expect(await readTaskSources(repoPath)).toEqual([
      { source: 'tox.ini', names: ['test', 'lint'] },
    ]);
  });

  it('does not count a symlink that points outside the repository', async () => {
    await writeFile(path.join(outside, 'go.work'), 'go 1.22\n');
    await writeFile(path.join(outside, 'Makefile'), 'secret:\n\techo\n');
    await symlink(
      path.join(outside, 'go.work'),
      path.join(repoPath, 'go.work'),
    );
    await symlink(
      path.join(outside, 'Makefile'),
      path.join(repoPath, 'Makefile'),
    );
    expect(await findWorkspaceConfig(repoPath)).toBeNull();
    expect(await readTaskSources(repoPath)).toEqual([]);
  });

  it('reads a nested golangci config for the Go formatter', async () => {
    await put(repoPath, 'svc/go.mod', 'module svc\n\ngo 1.22\n');
    await put(
      repoPath,
      'svc/.golangci.yml',
      'formatters:\n  enable: [gofumpt]\n',
    );
    const result = await checkCodeStyle(repoPath);
    expect(result.findings).toContainEqual({
      status: 'pass',
      message: 'Go formatter enabled in svc/.golangci.yml',
      files: ['svc/.golangci.yml'],
    });
  });
});
