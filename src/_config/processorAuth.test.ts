import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../configDB', () => ({
  externalAPI: {
    token: 'processor-token-with-at-least-32-characters'
  }
}));

vi.mock('../observability/metrics', () => ({
  authenticationAnomalyCounter: {
    inc: vi.fn()
  }
}));

import { externalAPI } from '../configDB';
import { authenticationAnomalyCounter } from '../observability/metrics';
import { isProcessorAuthenticated } from './processorAuth';

const invoke = (header?: string | string[]) => {
  const next = vi.fn();
  isProcessorAuthenticated({
    headers: header === undefined
      ? {}
      : { 'x-cmms-processor-token': header }
  } as any, {} as any, next);
  return next;
};

describe('processor-only authentication boundary', () => {
  beforeEach(() => {
    externalAPI.token = 'processor-token-with-at-least-32-characters';
    vi.mocked(authenticationAnomalyCounter.inc).mockClear();
  });

  it('accepts only the exact dedicated processor credential', () => {
    const next = invoke(externalAPI.token);
    const arrayHeaderNext = invoke([externalAPI.token!]);
    expect(next).toHaveBeenCalledWith();
    expect(arrayHeaderNext).toHaveBeenCalledWith();
    expect(authenticationAnomalyCounter.inc).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    '',
    'wrong-token',
    `${'x'.repeat(1)}${'processor-token-with-at-least-32-characters'.slice(1)}`,
    ['wrong-token'],
    []
  ])(
    'rejects missing or invalid processor credential %s',
    (value) => {
      const next = invoke(value as any);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 401,
          message: 'Invalid processor credential'
        })
      );
      expect(authenticationAnomalyCounter.inc).toHaveBeenCalledWith({
        reason: 'processor_invalid_credential'
      });
    }
  );

  it('fails closed when the processor secret is not configured', () => {
    externalAPI.token = undefined;
    const next = invoke('any-token');
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 503,
        message: 'Processor authentication is unavailable'
      })
    );
  });
});
