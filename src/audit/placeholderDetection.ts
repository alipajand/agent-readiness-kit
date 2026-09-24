import { readTextFile } from '../fs/readTextFile.js';

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
  const content = await readTextFile(filePath);
  return content !== null && containsPlaceholderContent(content);
}
