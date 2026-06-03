import { readFile } from 'node:fs/promises';

export const PLACEHOLDER_PATTERNS = [
  '<!-- Describe',
  '<!-- List',
  '<!-- What problem',
  '<!-- e.g.',
  'In scope:',
  'Out of scope:',
  'List paths to read before editing.',
] as const;

export const PLACEHOLDER_WARNING =
  'File appears to contain starter placeholders — customize before relying on agents';

export function containsPlaceholderContent(content: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => content.includes(pattern));
}

export async function fileHasPlaceholderContent(
  filePath: string,
): Promise<boolean> {
  try {
    const content = await readFile(filePath, 'utf8');
    return containsPlaceholderContent(content);
  } catch {
    return false;
  }
}
