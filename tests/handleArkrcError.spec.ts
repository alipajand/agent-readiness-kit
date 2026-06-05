import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleArkrcError } from '../src/config/handleArkrcError.js';
import { ArkrcError } from '../src/config/loadArkrc.js';

describe('handleArkrcError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the message and exits with code 1 for ArkrcError', () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => handleArkrcError(new ArkrcError('bad config'))).toThrow(
      'exit:1',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('bad config');
  });

  it('rethrows errors that are not ArkrcError', () => {
    const original = new Error('unexpected');
    expect(() => handleArkrcError(original)).toThrow(original);
  });
});
