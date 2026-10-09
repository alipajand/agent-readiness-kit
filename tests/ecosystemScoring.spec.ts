import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditRepo } from '../src/audit/auditRepo.js';
import type { AuditResult, CategoryResult } from '../src/types.js';

/**
 * Representative repositories for issue #28. Expected scores are derived from
 * the rules in docs/SCORING.md; each derivation is written next to the
 * assertion. Ecosystem-specific signals score
 * floor(points * satisfied / detected ecosystems).
 */

const created: string[] = [];

async function repo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'ark-eco-'));
  created.push(root);
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    await writeFile(path.join(root, rel), content);
  }
  return root;
}

afterEach(async () => {
  while (created.length > 0) {
    await rm(created.pop() as string, { recursive: true, force: true });
  }
});

function cat(result: AuditResult, id: string): CategoryResult {
  const found = result.categories.find((c) => c.id === id);
  if (!found) throw new Error(`category ${id} missing`);
  return found;
}

function messages(result: AuditResult, id?: string): string[] {
  return result.categories
    .filter((c) => id === undefined || c.id === id)
    .flatMap((c) => c.findings.map((f) => f.message));
}

/** Node.js-only wording that must not appear for a stack without Node.js. */
const NODE_ONLY = /package\.json|Node\.js|ESLint|Prettier|vitest|pnpm|npm/;

const GO_MOD_WITH_DEPS =
  'module example.com/x\n\ngo 1.22\n\nrequire github.com/google/uuid v1.6.0\n';

describe('ecosystem-aware scoring fixtures', () => {
  it('1. Node.js project with a complete setup keeps its scores', async () => {
    const root = await repo({
      'package.json': JSON.stringify({
        scripts: {
          dev: 'tsx src',
          build: 'tsc',
          lint: 'eslint .',
          test: 'vitest run',
          typecheck: 'tsc --noEmit',
          format: 'prettier --write .',
          clean: 'rm -rf dist',
        },
        engines: { node: '>=20' },
      }),
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
      'vitest.config.ts': 'export default {}\n',
      'src/a.test.ts': 'test\n',
      '.github/workflows/ci.yml': 'name: CI\n',
      '.github/dependabot.yml': 'version: 2\n',
      'eslint.config.js': 'export default []\n',
      '.prettierrc': '{}\n',
      '.editorconfig': 'root = true\n',
      '.gitignore': 'node_modules\ndist\n.env\n.DS_Store\n',
    });
    const result = await auditRepo(root);
    expect(result.ecosystems).toEqual(['node']);
    // All 7 scripts: 2+3+2+3+3+1+1
    expect(cat(result, 'workflow').score).toBe(15);
    // files 5 + runner 4 (1/1) + CI 3 + test script 2 + coverage 1 (vitest)
    expect(cat(result, 'testing').score).toBe(15);
    // lockfile 3 (1/1) + pin 2 (1/1) + dependabot 3
    expect(cat(result, 'dependencies').score).toBe(8);
    // ESLint 3 (1/1) + Prettier 3 (1/1) + .editorconfig 2
    expect(cat(result, 'code-style').score).toBe(8);
    // node_modules, dist, .env, .DS_Store: 4 of 4 covered
    expect(cat(result, 'git-hygiene').score).toBe(3);
    // Node.js findings keep their original wording.
    expect(messages(result, 'workflow')[0]).toBe(
      'Scripts present: dev, build, lint, test, typecheck, format, clean',
    );
    expect(messages(result, 'dependencies')).toContain(
      'Lockfile present: pnpm-lock.yaml',
    );
  });

  it('2. Node.js project missing tests is still penalized', async () => {
    const root = await repo({
      'package.json': JSON.stringify({
        scripts: { build: 'tsc', lint: 'eslint .' },
      }),
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    });
    const result = await auditRepo(root);
    // build 3 + lint 2
    expect(cat(result, 'workflow').score).toBe(5);
    expect(cat(result, 'testing').score).toBe(0);
    expect(messages(result, 'testing')).toEqual(
      expect.arrayContaining([
        'No test files detected',
        'No vitest/jest/playwright/cypress config found',
        'No test script in package.json',
      ]),
    );
    expect(messages(result, 'workflow')).toContain(
      'Missing test script — agents need a clear test command',
    );
    expect(result.recommendations).toContain(
      'Add a test script to package.json',
    );
    // lockfile 3, no pin
    expect(cat(result, 'dependencies').score).toBe(3);
  });

  it('3. Go project with *_test.go scores Go equivalents', async () => {
    const root = await repo({
      'go.mod': GO_MOD_WITH_DEPS,
      'go.sum': 'github.com/google/uuid v1.6.0 h1:x\n',
      'main.go': 'package main\n',
      'main_test.go':
        'package main\n\nimport "testing"\n\nfunc TestX(t *testing.T) {}\n',
      Makefile:
        '.PHONY: build test lint fmt\nbuild:\n\tgo build ./...\ntest:\n\tgo test ./...\nlint:\n\tgolangci-lint run\nfmt:\n\tgofmt -w .\n',
      '.golangci.yml': 'linters:\n  enable: [govet]\n',
      '.gitignore': '*.exe\n*.test\n*.out\n.env\n',
    });
    const result = await auditRepo(root);
    expect(result.ecosystems).toEqual(['go']);
    // build 3 + test 3 + lint 2 + format 1 + typecheck via build 3
    expect(cat(result, 'workflow').score).toBe(12);
    // files 5 + built-in runner 4 (1/1) + Makefile test 2
    expect(cat(result, 'testing').score).toBe(11);
    // go.sum 3 + go directive 2
    expect(cat(result, 'dependencies').score).toBe(5);
    // golangci 3 + gofmt in Makefile 3
    expect(cat(result, 'code-style').score).toBe(6);
    // .env, binaries, coverage covered; .DS_Store missing: 3 of 4
    expect(cat(result, 'git-hygiene').score).toBe(3);
    expect(messages(result).filter((m) => NODE_ONLY.test(m))).toEqual([]);
  });

  it('4. Go project without tests fails testing without Node.js advice', async () => {
    const root = await repo({
      'go.mod': GO_MOD_WITH_DEPS,
      'main.go': 'package main\n',
    });
    const result = await auditRepo(root);
    expect(cat(result, 'testing').score).toBe(0);
    expect(messages(result, 'testing')).toEqual(
      expect.arrayContaining([
        'No test files detected',
        'No Go tests for go test to run',
      ]),
    );
    // go.mod requires a module but go.sum is missing: lockfile 0; pin 2
    expect(cat(result, 'dependencies').score).toBe(2);
    expect(cat(result, 'dependencies').findings).toContainEqual({
      status: 'fail',
      message: 'No go.sum found for a go.mod that declares dependencies',
    });
    expect(cat(result, 'workflow').score).toBe(0);
    expect(
      messages(result)
        .filter((m) => !m.startsWith('No task runner commands found'))
        .filter((m) => !m.startsWith('No test command defined'))
        .filter((m) => NODE_ONLY.test(m)),
    ).toEqual([]);
    expect(result.recommendations).not.toContain(
      'Add tests and a package.json test script',
    );
  });

  it('5. Python project with pytest scores Python equivalents', async () => {
    const root = await repo({
      'pyproject.toml': [
        '[project]',
        'name = "x"',
        'requires-python = ">=3.11"',
        '',
        '[tool.pytest.ini_options]',
        'testpaths = ["tests"]',
        '',
        '[tool.ruff]',
        'line-length = 100',
        '',
        '[tool.ruff.format]',
        'quote-style = "double"',
        '',
        '[tool.poe.tasks]',
        'test = "pytest"',
        'lint = "ruff check ."',
        'typecheck = "mypy src"',
        '',
      ].join('\n'),
      'uv.lock': 'version = 1\n',
      'src/x/__init__.py': '',
      'tests/test_core.py': 'def test_a():\n    assert True\n',
    });
    const result = await auditRepo(root);
    expect(result.ecosystems).toEqual(['python']);
    // test 3 + lint 2 + typecheck 3
    expect(cat(result, 'workflow').score).toBe(8);
    // files 5 + pytest config 4 + poe test task 2
    expect(cat(result, 'testing').score).toBe(11);
    // uv.lock 3 + requires-python 2
    expect(cat(result, 'dependencies').score).toBe(5);
    // [tool.ruff] 3 + [tool.ruff.format] 3
    expect(cat(result, 'code-style').score).toBe(6);
    expect(messages(result).filter((m) => NODE_ONLY.test(m))).toEqual([]);
  });

  it('6. Python project without tests or a lockfile', async () => {
    const root = await repo({
      'pyproject.toml': '[project]\nname = "x"\nrequires-python = ">=3.11"\n',
      'requirements.txt': 'requests>=2\n',
      'src/x/__init__.py': '',
    });
    const result = await auditRepo(root);
    expect(cat(result, 'testing').score).toBe(0);
    expect(messages(result, 'testing')).toContain(
      'No pytest configuration found (pytest.ini, conftest.py, [tool.pytest.ini_options], tox.ini, or noxfile.py)',
    );
    // requirements.txt is not pinned: lockfile 0; requires-python 2
    expect(cat(result, 'dependencies').score).toBe(2);
    expect(cat(result, 'dependencies').findings[0].status).toBe('fail');
  });

  it('7. Rust project with standard test conventions', async () => {
    const root = await repo({
      'Cargo.toml': '[package]\nname = "x"\nrust-version = "1.80"\n',
      'Cargo.lock': 'version = 4\n',
      'src/lib.rs':
        'pub fn add() {}\n\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn adds() {}\n}\n',
      'tests/integration.rs': '#[test]\nfn it() {}\n',
      'rustfmt.toml': 'edition = "2021"\n',
      'clippy.toml': 'msrv = "1.80"\n',
    });
    const result = await auditRepo(root);
    expect(result.ecosystems).toEqual(['rust']);
    // files 5 + built-in cargo test 4; no CI, no task runner
    expect(cat(result, 'testing').score).toBe(9);
    expect(messages(result, 'testing')[0]).toBe('Test files found (2): Rust');
    // Cargo.lock 3 + rust-version 2
    expect(cat(result, 'dependencies').score).toBe(5);
    // clippy.toml 3 + rustfmt.toml 3
    expect(cat(result, 'code-style').score).toBe(6);
  });

  it('8. polyglot Python API + Node.js frontend scores both stacks', async () => {
    const root = await repo({
      'pyproject.toml':
        '[project]\nname = "api"\nrequires-python = ">=3.11"\n\n[tool.pytest.ini_options]\n',
      'uv.lock': 'version = 1\n',
      'tests/test_api.py': 'def test_a():\n    pass\n',
      'frontend/package.json': JSON.stringify({
        scripts: {
          dev: 'next dev',
          build: 'next build',
          lint: 'next lint',
          test: 'jest',
        },
      }),
      'frontend/src/page.test.tsx': 'test\n',
    });
    const result = await auditRepo(root);
    expect(result.ecosystems).toEqual(['node', 'python']);
    // dev 2 + build 3 + lint 2 + test 3, from frontend/package.json
    expect(cat(result, 'workflow').score).toBe(10);
    // files 5 + runner floor(4 * 1/2) = 2 + frontend test script 2
    expect(cat(result, 'testing').score).toBe(9);
    // lockfile floor(3 * 1/2) = 1 + pin floor(2 * 1/2) = 1
    expect(cat(result, 'dependencies').score).toBe(2);
    // The Node.js side is still checked and reported.
    expect(cat(result, 'dependencies').findings).toContainEqual({
      status: 'fail',
      message:
        'No lockfile found (pnpm-lock.yaml / package-lock.json / yarn.lock)',
    });
    expect(messages(result, 'testing')).toContain(
      'No vitest/jest/playwright/cypress config found',
    );
  });

  it('9. minimal repository without readiness docs stays low', async () => {
    const root = await repo({
      'go.mod': 'module x\n\ngo 1.22\n',
      'main.go': 'package main\n',
    });
    const result = await auditRepo(root);
    // Only evidence: go.mod with no requirements (lockfile 3) and its go
    // directive (pin 2). Every other category has nothing to score.
    expect(cat(result, 'dependencies').score).toBe(5);
    expect(result.score).toBe(5);
    for (const id of [
      'agent-instructions',
      'architecture',
      'workflow',
      'testing',
      'safety',
      'prompt-assets',
    ]) {
      expect(cat(result, id).score).toBe(0);
    }
  });

  it('10. unknown ecosystem gets no ecosystem points without evidence', async () => {
    const root = await repo({
      'pom.xml': '<project></project>\n',
      'src/main/java/App.java': 'class App {}\n',
      'src/test/java/AppTest.java': 'class AppTest {}\n',
      '.github/workflows/ci.yml': 'name: CI\n',
    });
    const result = await auditRepo(root);
    expect(result.ecosystems).toEqual([]);
    // files 5 + CI 3; runner and test command have no evidence
    expect(cat(result, 'testing').score).toBe(8);
    expect(messages(result, 'testing')).toContain(
      'No test runner config found (vitest, jest, playwright, cypress, or pytest)',
    );
    expect(cat(result, 'dependencies').score).toBe(0);
    expect(messages(result, 'dependencies')).toContain(
      'No dependency manifest or lockfile found',
    );
    expect(cat(result, 'workflow').score).toBe(0);
    expect(cat(result, 'code-style').score).toBe(0);
  });

  it('11. generated, vendored, and example files do not count', async () => {
    const root = await repo({
      'go.mod': 'module x\n\ngo 1.22\n',
      'main.go': 'package main\n',
      'vendor/github.com/a/b/b_test.go': 'package b\n',
      'node_modules/pkg/package.json': '{}',
      'node_modules/pkg/index.test.js': '',
      'dist/app.test.js': '',
      'build/gen_test.go': '',
      'internal/testdata/case_test.go': '',
      'tests/fixtures/sample.test.ts': '',
      'examples/web/package.json': JSON.stringify({ scripts: { test: 'x' } }),
      '.venv/lib/python3.12/site-packages/pkg/pyproject.toml': '',
    });
    const result = await auditRepo(root);
    expect(result.ecosystems).toEqual(['go']);
    expect(cat(result, 'testing').findings[0]).toEqual({
      status: 'fail',
      message: 'No test files detected',
    });
    expect(cat(result, 'testing').score).toBe(0);
  });

  it('12. instructions without Node.js files score generic categories the same', async () => {
    const docs = {
      'AGENTS.md':
        '# Agent instructions\n\n## Commands\n\nRun `make test`.\n\n## Safety\n\nNever commit secrets. Ask before migrations.\n',
      'CLAUDE.md': '@AGENTS.md\n',
      'README.md': '# Project\n\n## Setup\n\nInstall.\n\n## Usage\n\nRun it.\n',
      'docs/ARCHITECTURE.md': '# Architecture\n\nThe service has two layers.\n',
      'SECURITY.md': '# Security\n\nReport issues privately.\n',
      '.env.example': 'API_TOKEN=\n',
    };
    const goRoot = await repo({
      ...docs,
      'go.mod': 'module x\n\ngo 1.22\n',
      'main.go': 'package main\n',
    });
    const nodeRoot = await repo({
      ...docs,
      'package.json': JSON.stringify({ name: 'x' }),
    });
    const go = await auditRepo(goRoot);
    const node = await auditRepo(nodeRoot);

    for (const id of [
      'agent-instructions',
      'architecture',
      'safety',
      'navigability',
      'prompt-assets',
      'documentation',
      'containerization',
      'ide-config',
    ]) {
      expect(cat(go, id).score).toBe(cat(node, id).score);
    }
    expect(cat(go, 'agent-instructions').score).toBe(20);
    expect(messages(go).filter((m) => NODE_ONLY.test(m))).toEqual([
      // The workflow and testing messages list package.json among the task
      // runners they accept; no finding asks for Node.js-only files.
      'No task runner commands found (package.json scripts, Makefile, justfile, Taskfile, pyproject.toml tasks, tox.ini, or noxfile.py)',
      'No test command defined (package.json scripts, Makefile, justfile, Taskfile, pyproject.toml tasks, tox.ini, or noxfile.py)',
    ]);
  });

  it('an empty repository scores 0 and detects no ecosystem', async () => {
    const root = await repo({});
    const result = await auditRepo(root);
    expect(result.ecosystems).toEqual([]);
    expect(result.score).toBe(0);
  });

  it('is deterministic across runs', async () => {
    const root = await repo({
      'go.mod': GO_MOD_WITH_DEPS,
      'a_test.go': '',
      'pyproject.toml': '[project]\nname = "x"\n',
      'web/package.json': '{}',
    });
    const first = await auditRepo(root);
    const second = await auditRepo(root);
    expect(second).toEqual(first);
    expect(first.ecosystems).toEqual(['node', 'python', 'go']);
  });

  it('does not merge nested package.json scripts in a Node.js monorepo', async () => {
    const root = await repo({
      'package.json': JSON.stringify({ scripts: { build: 'turbo build' } }),
      'apps/web/package.json': JSON.stringify({
        scripts: { lint: 'eslint .', test: 'vitest' },
      }),
    });
    const result = await auditRepo(root);
    // Root scripts only, as before: build 3
    expect(cat(result, 'workflow').score).toBe(3);
    expect(messages(result, 'workflow')[0]).toBe('Scripts present: build');
  });

  it('counts pre-commit hooks and Go workspaces as language-neutral signals', async () => {
    const root = await repo({
      'go.work': 'go 1.22\n\nuse ./svc\n',
      'svc/go.mod': 'module svc\n\ngo 1.22\n',
      '.pre-commit-config.yaml': 'repos: []\n',
      'README.md': '# x\n',
    });
    const result = await auditRepo(root);
    expect(cat(result, 'git-hygiene').findings).toContainEqual({
      status: 'pass',
      message: 'Git hooks configured: .pre-commit-config.yaml',
      files: ['.pre-commit-config.yaml'],
    });
    // README 5 + workspace 2
    expect(cat(result, 'architecture').score).toBe(7);
    expect(messages(result, 'dependencies')).toContain(
      'Workspace config: go.work',
    );
  });
});
