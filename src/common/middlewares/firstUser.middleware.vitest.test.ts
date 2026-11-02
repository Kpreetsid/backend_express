import { describe, expect, it, vi } from 'vitest';
import { requireFirstUser } from './firstUser.middleware';

describe('requireFirstUser', () => {
  it.each([
    ['a non-first user', { user: { isFirstUser: false } }],
    ['a user without the first-user flag', { user: {} }],
    ['a request without an authenticated user', {}]
  ])('rejects %s with 403', (_scenario, req) => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const next = vi.fn();

    requireFirstUser(req as any, { status } as any, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      status: false,
      code: 'FIRST_USER_REQUIRED'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('passes an authenticated first user to the next handler', () => {
    const next = vi.fn();

    requireFirstUser({ user: { isFirstUser: true } } as any, {} as any, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
