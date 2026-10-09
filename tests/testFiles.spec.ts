import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findTestFiles } from '../src/audit/testFiles.js';
import { checkTesting } from '../src/audit/checks/testing.js';

async function put(root: string, rel: string, content = ''): Promise<void> {
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await writeFile(path.join(root, rel), content);
}

describe('findTestFiles', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-testfiles-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  const relative = async () =>
    (await findTestFiles(repoPath)).files.map((f) =>
      path.relative(repoPath, f).split(path.sep).join('/'),
    );

  it('finds nothing in an empty repository', async () => {
    expect(await findTestFiles(repoPath)).toEqual({ files: [], languages: [] });
  });

  it.each([
    ['JavaScript/TypeScript', 'src/app.test.ts'],
    ['JavaScript/TypeScript', 'src/app.spec.js'],
    ['JavaScript/TypeScript', 'src/app.test.mjs'],
    ['JavaScript/TypeScript', 'src/__tests__/app.ts'],
    ['Go', 'main_test.go'],
    ['Go', 'internal/store/store_test.go'],
    ['Python', 'pkg/test_models.py'],
    ['Python', 'pkg/models_test.py'],
    ['Rust', 'crates/core/tests/integration.rs'],
    ['Ruby', 'spec/models/user_spec.rb'],
    ['Ruby', 'lib/test_parser.rb'],
    ['Ruby', 'app/models/user_test.rb'],
    ['Java/Kotlin', 'src/test/java/com/x/AppTest.java'],
    ['Java/Kotlin', 'module/src/main/kotlin/ParserTests.kt'],
    ['C#', 'App.Tests/CalculatorTests.cs'],
  ])('recognizes %s convention: %s', async (language, rel) => {
    await put(repoPath, rel, 'x');
    const scan = await findTestFiles(repoPath);
    expect(scan.languages).toContain(language);
    expect(await relative()).toContain(rel);
  });

  it('does not count files that only look like tests', async () => {
    await put(repoPath, 'main.go', 'package main');
    await put(repoPath, 'testing.go', 'package main');
    await put(repoPath, 'conftest.py', '');
    await put(repoPath, 'src/contest.py', '');
    await put(repoPath, 'src/latest.ts', '');
    expect(await relative()).toEqual([]);
  });

  it('ignores dependencies, build output, virtualenvs, and fixtures', async () => {
    for (const rel of [
      'node_modules/pkg/index.test.js',
      'vendor/github.com/x/y/y_test.go',
      'third_party/lib/lib_test.go',
      '.venv/lib/python3.12/site-packages/pkg/test_pkg.py',
      'venv/lib/test_x.py',
      '.tox/py312/test_x.py',
      'dist/app.test.js',
      'build/generated.test.js',
      'target/debug/tests/gen.rs',
      'coverage/lcov-report/app.test.js',
      'tests/fixtures/sample.test.ts',
      'internal/parser/testdata/case_test.go',
    ]) {
      await put(repoPath, rel, 'x');
    }
    expect(await relative()).toEqual([]);
  });

  it('finds Rust inline unit tests when Cargo.toml is present', async () => {
    await put(repoPath, 'Cargo.toml', '[package]\nname = "x"\n');
    await put(repoPath, 'src/lib.rs', 'pub fn a() {}\n');
    await put(
      repoPath,
      'src/math.rs',
      'pub fn add() {}\n#[cfg(test)]\nmod tests {\n  #[test]\n  fn adds() {}\n}\n',
    );
    const scan = await findTestFiles(repoPath);
    expect(scan.languages).toEqual(['Rust']);
    expect(await relative()).toEqual(['src/math.rs']);
  });

  it('does not read Rust sources for inline tests without Cargo.toml', async () => {
    await put(repoPath, 'src/math.rs', '#[test]\nfn adds() {}\n');
    expect(await relative()).toEqual([]);
  });

  it('lists each file once when several conventions match it', async () => {
    await put(repoPath, 'tests/test_api.py', '');
    await put(repoPath, 'tests/api.test.ts', '');
    expect(await relative()).toEqual([
      'tests/api.test.ts',
      'tests/test_api.py',
    ]);
  });

  it('returns files in a stable sorted order', async () => {
    await put(repoPath, 'z_test.go', '');
    await put(repoPath, 'a_test.go', '');
    await put(repoPath, 'm/test_m.py', '');
    const first = await relative();
    expect(first).toEqual([...first].sort());
    expect(await relative()).toEqual(first);
  });
});

describe('checkTesting test file detection (issue #27)', () => {
  let repoPath: string;

  beforeEach(async () => {
    repoPath = await mkdtemp(path.join(tmpdir(), 'ark-testing-go-'));
  });

  afterEach(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('counts main_test.go in a Go module', async () => {
    await put(repoPath, 'go.mod', 'module x\n\ngo 1.22\n');
    await put(repoPath, 'main.go', 'package main\n');
    await put(
      repoPath,
      'main_test.go',
      'package main\n\nimport "testing"\n\nfunc TestX(t *testing.T) {}\n',
    );
    const result = await checkTesting(repoPath);
    const pass = result.findings.find((f) =>
      f.message.startsWith('Test files found'),
    );
    expect(pass?.status).toBe('pass');
    expect(pass?.message).toBe('Test files found (1): Go');
    expect(pass?.files).toEqual(['main_test.go']);
    expect(
      result.findings.some((f) => f.message === 'No test files detected'),
    ).toBe(false);
  });

  it('still fails a Go module without tests', async () => {
    await put(repoPath, 'go.mod', 'module x\n\ngo 1.22\n');
    await put(repoPath, 'main.go', 'package main\n');
    const result = await checkTesting(repoPath);
    expect(result.findings).toContainEqual({
      status: 'fail',
      message: 'No test files detected',
    });
  });

  it('counts pytest-style tests in a Python project', async () => {
    await put(repoPath, 'pyproject.toml', '[project]\nname = "x"\n');
    await put(repoPath, 'src/x/test_core.py', 'def test_a():\n    pass\n');
    const result = await checkTesting(repoPath);
    expect(
      result.findings.find((f) => f.message.startsWith('Test files found'))
        ?.message,
    ).toBe('Test files found (1): Python');
  });

  it('does not count vendored or generated tests as the repository tests', async () => {
    await put(repoPath, 'go.mod', 'module x\n\ngo 1.22\n');
    await put(repoPath, 'vendor/github.com/a/b/b_test.go', '');
    await put(repoPath, 'node_modules/x/x.test.js', '');
    await put(repoPath, 'dist/x.test.js', '');
    const result = await checkTesting(repoPath);
    expect(result.findings).toContainEqual({
      status: 'fail',
      message: 'No test files detected',
    });
  });
});
