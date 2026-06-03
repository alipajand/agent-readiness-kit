import pc from 'picocolors';
import { ArkrcError } from './loadArkrc.js';

export function handleArkrcError(err: unknown): never {
  if (err instanceof ArkrcError) {
    console.error(pc.red(err.message));
    process.exit(1);
  }
  throw err;
}
