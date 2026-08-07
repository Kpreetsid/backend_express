import { describe, expect, it, vi } from 'vitest';
import { validateParam, validateParamId } from './validate';

describe('route identifier validation', () => {
  it('rejects missing and malformed identifiers with a 400 domain error', () => {
    expect(() => validateParam('assetId')({ params: {} } as any, {} as any, vi.fn()))
      .toThrow('assetId is required');
    expect(() => validateParamId({ params: { id: 'not-an-object-id' } } as any, {} as any, vi.fn()))
      .toThrow('Invalid id');
  });

  it('allows valid MongoDB identifiers to continue', () => {
    const next = vi.fn();
    validateParamId({ params: { id: '507f1f77bcf86cd799439011' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
