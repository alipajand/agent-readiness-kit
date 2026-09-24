import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';

/** Files above this size are never read into memory. */
export const MAX_TEXT_FILE_BYTES = 1024 * 1024;

// O_NONBLOCK keeps open() from waiting on a FIFO with no writer; it has no
// effect on regular files. It is undefined on Windows, which has no FIFOs.
const READ_FLAGS = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0);

export type RegularFileRead =
  | { status: 'ok'; content: string }
  | { status: 'missing' }
  | { status: 'not-a-file' }
  | { status: 'too-large' }
  | { status: 'error'; error: unknown };

/**
 * Read a regular file as UTF-8. The type and size are checked on the opened
 * handle, not the path, so the file cannot be swapped for a FIFO, device, or
 * larger file between the check and the read.
 */
export async function readRegularFile(
  filePath: string,
  maxBytes: number = MAX_TEXT_FILE_BYTES,
): Promise<RegularFileRead> {
  let handle: FileHandle;
  try {
    handle = await open(filePath, READ_FLAGS);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return { status: 'missing' };
    if (code === 'EISDIR') return { status: 'not-a-file' };
    return { status: 'error', error };
  }

  try {
    const info = await handle.stat();
    if (!info.isFile()) return { status: 'not-a-file' };
    if (info.size > maxBytes) return { status: 'too-large' };

    // Read at most the size seen above, even if the file grows meanwhile.
    const buffer = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return {
      status: 'ok',
      content: buffer.subarray(0, offset).toString('utf8'),
    };
  } catch (error) {
    return { status: 'error', error };
  } finally {
    await handle.close();
  }
}

/**
 * Read a regular file as UTF-8, or return null. FIFOs, devices, directories,
 * and files larger than `maxBytes` are not read, so a hostile repository
 * cannot hang an audit or exhaust memory.
 */
export async function readTextFile(
  filePath: string,
  maxBytes: number = MAX_TEXT_FILE_BYTES,
): Promise<string | null> {
  const result = await readRegularFile(filePath, maxBytes);
  return result.status === 'ok' ? result.content : null;
}
