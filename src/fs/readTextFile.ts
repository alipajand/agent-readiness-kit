import { readFile, stat } from 'node:fs/promises';

/** Files above this size are never read into memory. */
export const MAX_TEXT_FILE_BYTES = 1024 * 1024;

/**
 * Read a regular file as UTF-8, or return null. FIFOs, devices, directories,
 * and files larger than `maxBytes` are not read, so a hostile repository
 * cannot hang an audit or exhaust memory.
 */
export async function readTextFile(
  filePath: string,
  maxBytes: number = MAX_TEXT_FILE_BYTES,
): Promise<string | null> {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size > maxBytes) return null;
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}
