import { describe, expect, it, vi } from 'vitest';
import { hasAnyRolePermission, hasRolePermission } from './permission';

const invoke = (
  middleware: ReturnType<typeof hasRolePermission>,
  user: Record<string, unknown>,
  role: Record<string, unknown>
) => {
  const next = vi.fn();
  middleware({ user, role } as any, {} as any, next);
  return next;
};

describe('reusable role-permission boundary', () => {
  it('allows an exact granted module action', () => {
    const next = invoke(
      hasRolePermission('asset', 'edit_asset'),
      { user_role: 'admin' },
      { asset: { edit_asset: true } }
    );
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    [{}, {}, 'Unauthorized access'],
    [{ user_role: 'invented-role' }, {}, 'Invalid user role'],
    [{ user_role: 'admin' }, {}, 'You do not have permission to access.'],
    [{ user_role: 'admin' }, { asset: { edit_asset: false } }, 'You do not have permission to access.']
  ])('fails closed for user %o and role map %o', (user, role, message) => {
    const next = invoke(hasRolePermission('asset', 'edit_asset'), user, role);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, message })
    );
  });

  it('allows any one of an explicitly listed set and denies an empty grant set', () => {
    const middleware = hasAnyRolePermission(
      { moduleName: 'asset', action: 'view_asset' },
      { moduleName: 'asset', action: 'edit_asset' }
    );
    const allowed = invoke(
      middleware,
      { user_role: 'admin' },
      { asset: { edit_asset: true } }
    );
    const denied = invoke(
      middleware,
      { user_role: 'admin' },
      { asset: { edit_asset: false, view_asset: false } }
    );

    expect(allowed).toHaveBeenCalledWith();
    expect(denied).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 })
    );
  });
});
