import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  containsPlaceholderContent,
  fileHasPlaceholderContent,
  PLACEHOLDER_PATTERNS,
  PLACEHOLDER_WARNING,
} from '../src/audit/placeholderDetection.js';
import {
  AGENTS_MD,
  ARCHITECTURE_MD,
  QA_AUDIT_PROMPT,
  FEATURE_IMPLEMENTATION_PROMPT,
  REFACTOR_PROMPT,
} from '../src/generate/templates.js';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

describe('placeholderDetection', () => {
  it('detects known starter placeholder patterns', () => {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      expect(containsPlaceholderContent(`Some text ${pattern} more text`)).toBe(
        true,
      );
    }
  });

  it('returns false for customized content without placeholders', () => {
    const content = `# Agents

## Project overview

This CLI audits repositories for AI agent readiness.

## Architecture boundaries

See docs/ARCHITECTURE.md for module boundaries.
`;
    expect(containsPlaceholderContent(content)).toBe(false);
  });

  it('detects placeholders in generated templates', () => {
    expect(containsPlaceholderContent(AGENTS_MD)).toBe(true);
    expect(containsPlaceholderContent(ARCHITECTURE_MD)).toBe(true);
    expect(containsPlaceholderContent(QA_AUDIT_PROMPT)).toBe(true);
    expect(containsPlaceholderContent(FEATURE_IMPLEMENTATION_PROMPT)).toBe(
      true,
    );
    expect(containsPlaceholderContent(REFACTOR_PROMPT)).toBe(true);
  });

  it('exports the expected warning message', () => {
    expect(PLACEHOLDER_WARNING).toBe(
      'File appears to contain starter placeholders — customize before relying on agents',
    );
  });

  it('does not flag this repo checked-in AGENTS.md or ARCHITECTURE.md', async () => {
    expect(
      await fileHasPlaceholderContent(path.join(repoRoot, 'AGENTS.md')),
    ).toBe(false);
    expect(
      await fileHasPlaceholderContent(
        path.join(repoRoot, 'docs/ARCHITECTURE.md'),
      ),
    ).toBe(false);
  });

  it('does not flag customized checked-in prompt docs', async () => {
    const promptPaths = [
      'docs/prompts/QA_AUDIT_PROMPT.md',
      'docs/prompts/FEATURE_IMPLEMENTATION_PROMPT.md',
      'docs/prompts/REFACTOR_PROMPT.md',
    ];

    for (const rel of promptPaths) {
      const filePath = path.join(repoRoot, rel);
      expect(await fileHasPlaceholderContent(filePath)).toBe(false);
      const content = await readFile(filePath, 'utf8');
      expect(containsPlaceholderContent(content)).toBe(false);
    }
  });
});
