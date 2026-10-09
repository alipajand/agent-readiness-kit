import { findFiles } from '../fs/findFiles.js';
import { readTextFile } from '../fs/readTextFile.js';

/**
 * Test file conventions by language. A file counts as a test when it matches
 * any pattern below and is not under one of `TEST_SCAN_IGNORE`.
 */
export const TEST_FILE_CONVENTIONS: ReadonlyArray<{
  language: string;
  patterns: string[];
}> = [
  {
    language: 'JavaScript/TypeScript',
    patterns: [
      '**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}',
      '**/__tests__/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}',
    ],
  },
  { language: 'Go', patterns: ['**/*_test.go'] },
  { language: 'Python', patterns: ['**/test_*.py', '**/*_test.py'] },
  { language: 'Rust', patterns: ['tests/**/*.rs', '**/tests/**/*.rs'] },
  {
    language: 'Ruby',
    patterns: ['**/*_spec.rb', '**/test_*.rb', '**/*_test.rb'],
  },
  {
    language: 'Java/Kotlin',
    patterns: ['**/src/test/**/*.{java,kt}', '**/*{Test,Tests}.{java,kt}'],
  },
  {
    language: 'C#',
    patterns: ['**/*.Tests/**/*.cs', '**/*{Test,Tests}.cs'],
  },
  // Any file under a root tests/ or test/ directory. Kept from the original
  // JavaScript-only patterns so existing repositories keep their result.
  { language: 'tests/ directory', patterns: ['tests/**/*', 'test/**/*'] },
];

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
  const files = new Set<string>();
  const languages: string[] = [];

  for (const { language, patterns } of TEST_FILE_CONVENTIONS) {
    const matches = await findFiles(repoPath, patterns, {
      ignore: TEST_SCAN_IGNORE,
    });
    const fresh = matches.filter((f) => !files.has(f));
    if (fresh.length > 0) {
      languages.push(language);
      for (const f of fresh) files.add(f);
    }
  }

  const rustInline = await findRustInlineTests(repoPath);
  const freshRust = rustInline.filter((f) => !files.has(f));
  if (freshRust.length > 0) {
    if (!languages.includes('Rust')) languages.push('Rust');
    for (const f of freshRust) files.add(f);
  }

  return { files: [...files].sort(), languages };
}

async function findRustInlineTests(repoPath: string): Promise<string[]> {
  const manifests = await findFiles(repoPath, '**/Cargo.toml', {
    ignore: TEST_SCAN_IGNORE,
  });
  if (manifests.length === 0) return [];

  const sources = await findFiles(repoPath, '**/src/**/*.rs', {
    ignore: TEST_SCAN_IGNORE,
  });
  const found: string[] = [];
  for (const file of sources.slice(0, MAX_RUST_SOURCES_SCANNED)) {
    const content = await readTextFile(file);
    if (content !== null && RUST_INLINE_TEST.test(content)) found.push(file);
  }
  return found;
}
