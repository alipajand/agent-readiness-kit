import path from 'node:path';
import { findFiles } from '../fs/findFiles.js';
import { readTextFile } from '../fs/readTextFile.js';

const JS_EXT = '{js,jsx,mjs,cjs,ts,tsx,mts,cts}';
const JS_EXT_RE = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/;

/**
 * Test file conventions by language. A file counts as a test when it matches
 * one of the patterns and is not under one of `TEST_SCAN_IGNORE`. `matches`
 * repeats the patterns as a check on a repository-relative POSIX path, so a
 * single directory walk can be split by language.
 */
export const TEST_FILE_CONVENTIONS: ReadonlyArray<{
  language: string;
  patterns: string[];
  matches: (rel: string, base: string, dirs: string[]) => boolean;
}> = [
  {
    language: 'JavaScript/TypeScript',
    patterns: [`**/*.{test,spec}.${JS_EXT}`, `**/__tests__/**/*.${JS_EXT}`],
    matches: (_rel, base, dirs) =>
      /\.(?:test|spec)\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(base) ||
      (dirs.includes('__tests__') && JS_EXT_RE.test(base)),
  },
  {
    language: 'Go',
    patterns: ['**/*_test.go'],
    matches: (_rel, base) => base.endsWith('_test.go'),
  },
  {
    language: 'Python',
    patterns: ['**/test_*.py', '**/*_test.py'],
    matches: (_rel, base) =>
      (base.startsWith('test_') || base.endsWith('_test.py')) &&
      base.endsWith('.py'),
  },
  {
    language: 'Rust',
    patterns: ['**/tests/**/*.rs'],
    matches: (_rel, base, dirs) =>
      dirs.includes('tests') && base.endsWith('.rs'),
  },
  {
    language: 'Ruby',
    patterns: ['**/*_spec.rb', '**/test_*.rb', '**/*_test.rb'],
    matches: (_rel, base) =>
      base.endsWith('.rb') &&
      (base.endsWith('_spec.rb') ||
        base.endsWith('_test.rb') ||
        base.startsWith('test_')),
  },
  {
    language: 'Java/Kotlin',
    patterns: ['**/src/test/**/*.{java,kt}', '**/*{Test,Tests}.{java,kt}'],
    matches: (rel, base) =>
      /\.(?:java|kt)$/.test(base) &&
      (`/${rel}`.includes('/src/test/') || /Tests?\.(?:java|kt)$/.test(base)),
  },
  {
    language: 'C#',
    patterns: ['**/*.Tests/**/*.cs', '**/*{Test,Tests}.cs'],
    matches: (_rel, base, dirs) =>
      base.endsWith('.cs') &&
      (dirs.some((d) => d.endsWith('.Tests')) || /Tests?\.cs$/.test(base)),
  },
  // Any file under a root tests/ or test/ directory. Kept from the original
  // JavaScript-only patterns so existing repositories keep their result.
  {
    language: 'tests/ directory',
    patterns: ['tests/**/*', 'test/**/*'],
    matches: (_rel, _base, dirs) => dirs[0] === 'tests' || dirs[0] === 'test',
  },
];

/** Test discovery does not descend further than this many directory levels. */
export const MAX_TEST_SCAN_DEPTH = 20;

/**
 * Directories that hold dependencies, build output, virtual environments, or
 * fixture data. Files in them are not the repository's own tests.
 */
export const TEST_SCAN_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/target/**',
  '**/vendor/**',
  '**/third_party/**',
  '**/.venv/**',
  '**/venv/**',
  '**/.tox/**',
  '**/.nox/**',
  '**/__pycache__/**',
  '**/site-packages/**',
  '**/coverage/**',
  '**/.next/**',
  '**/bin/**',
  '**/obj/**',
  '**/fixtures/**',
  '**/__fixtures__/**',
  '**/testdata/**',
];

/** Upper bound on Rust sources read when looking for inline unit tests. */
const MAX_RUST_SOURCES_SCANNED = 500;

const RUST_INLINE_TEST = /#\[(?:cfg\(test\)|test|tokio::test)\]/;

export type TestFileScan = {
  /** Absolute paths, sorted. */
  files: string[];
  /** Languages whose conventions matched at least one file, in table order. */
  languages: string[];
};

/**
 * Find test files across language conventions. Rust unit tests live inline in
 * source files, so when a `Cargo.toml` is present the Rust sources are read
 * for `#[test]` or `#[cfg(test)]`.
 */
export async function findTestFiles(repoPath: string): Promise<TestFileScan> {
  // One directory walk for every convention plus the Rust inline-test inputs.
  const found = await findFiles(
    repoPath,
    [
      ...TEST_FILE_CONVENTIONS.flatMap((c) => c.patterns),
      '**/Cargo.toml',
      '**/src/**/*.rs',
    ],
    { ignore: TEST_SCAN_IGNORE, deep: MAX_TEST_SCAN_DEPTH },
  );

  const byLanguage = new Map<string, string[]>();
  let hasCargo = false;
  const rustSources: string[] = [];
  for (const file of found) {
    const rel = path.relative(repoPath, file).split(path.sep).join('/');
    const parts = rel.split('/');
    const base = parts[parts.length - 1];
    const dirs = parts.slice(0, -1);
    if (base === 'Cargo.toml') hasCargo = true;
    const convention = TEST_FILE_CONVENTIONS.find((c) =>
      c.matches(rel, base, dirs),
    );
    if (convention) {
      const list = byLanguage.get(convention.language) ?? [];
      list.push(file);
      byLanguage.set(convention.language, list);
    } else if (base.endsWith('.rs') && dirs.includes('src')) {
      rustSources.push(file);
    }
  }

  const files: string[] = [];
  const languages: string[] = [];
  for (const { language } of TEST_FILE_CONVENTIONS) {
    const list = byLanguage.get(language);
    if (list) {
      languages.push(language);
      files.push(...list);
    }
  }

  // Rust unit tests live inline in source files.
  if (hasCargo) {
    const inline: string[] = [];
    for (const file of rustSources.slice(0, MAX_RUST_SOURCES_SCANNED)) {
      const content = await readTextFile(file);
      if (content !== null && RUST_INLINE_TEST.test(content)) inline.push(file);
    }
    if (inline.length > 0) {
      if (!languages.includes('Rust')) languages.push('Rust');
      files.push(...inline);
    }
  }

  return { files: files.sort(), languages };
}
