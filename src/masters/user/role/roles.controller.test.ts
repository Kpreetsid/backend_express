import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rolesController } from './roles.controller';
import { rolesService } from './roles.service';
import { usersService } from '../user.service';
import { RoleManager } from '../../../_role/newUserRoles';

vi.mock('./roles.service', () => ({
  rolesService: {
    getRoles: vi.fn(),
    insertRole: vi.fn(),
    updateById: vi.fn(),
    removeById: vi.fn()
  }
}));

vi.mock('../user.service', () => ({
  usersService: {
    getAllUsers: vi.fn()
  }
}));

vi.mock('../../../_role/newUserRoles', () => ({
  RoleManager: {
    getRoleMenuData: vi.fn()
  }
}));

describe('role administration tenant and permission boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const foreignAccountId = '507f1f77bcf86cd799439099';
  const actorId = '507f1f77bcf86cd799439012';
  const targetUserId = '507f1f77bcf86cd799439013';
  const roleId = '507f1f77bcf86cd799439014';

  const makeRequest = (overrides: Record<string, unknown> = {}) => ({
    user: { _id: actorId, account_id: accountId, user_role: 'admin' },
    role: {
      asset: { edit_asset: true, delete_asset: false },
      permission: { view: true, add: true, edit: true, delete: true }
    },
    params: {},
    query: {},
    body: {},
    ...overrides
  } as any);

  const makeResponse = () => {
    const response: any = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes a role lookup to the authenticated account', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([{ _id: roleId }] as never);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.getAll(
      makeRequest({ query: { user_id: targetUserId } }),
      response,
      next
    );

    expect(rolesService.getRoles).toHaveBeenCalledWith({
      account_id: accountId,
      user_id: expect.objectContaining({})
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a not-found error when the account has no matching roles', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.getAll(makeRequest(), response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Role not found'
    }));
    expect(response.status).not.toHaveBeenCalled();
  });

  it('loads only the authenticated user role through the self route', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([{ _id: roleId }] as never);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.myRoleData(makeRequest(), response, next);

    expect(rolesService.getRoles).toHaveBeenCalledWith({
      account_id: accountId,
      user_id: actorId
    });
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      status: true,
      message: 'Role fetched successfully'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns not found when the authenticated user role is absent', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.myRoleData(makeRequest(), response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Role not found'
    }));
  });

  it('loads a role record by ID inside the authenticated account', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([{ _id: roleId }] as never);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.getDataById(
      makeRequest({ params: { id: roleId } }),
      response,
      next
    );

    expect(rolesService.getRoles).toHaveBeenCalledWith({
      account_id: accountId,
      _id: expect.objectContaining({})
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('updates only role data through an account-scoped write', async () => {
    const data = { asset: { edit_asset: true, delete_asset: false } };
    vi.mocked(rolesService.getRoles).mockResolvedValue([{ _id: roleId }] as never);
    vi.mocked(rolesService.updateById).mockResolvedValue({ _id: roleId, data } as never);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.updateRole(
      makeRequest({
        params: { id: roleId },
        body: {
          data,
          account_id: foreignAccountId,
          user_id: '507f1f77bcf86cd799439088',
          roleMenu: { admin: true },
          createdBy: foreignAccountId
        }
      }),
      response,
      next
    );

    expect(rolesService.updateById).toHaveBeenCalledWith(
      roleId,
      accountId,
      data,
      actorId
    );
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      status: true,
      message: 'Role updated successfully'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a grant that exceeds the acting user permission ceiling', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([{ _id: roleId }] as never);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.updateRole(
      makeRequest({
        params: { id: roleId },
        body: { data: { asset: { delete_asset: true } } }
      }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 403,
      message: 'Permission exceeds authorized scope: asset.delete_asset'
    }));
    expect(rolesService.updateById).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects malformed and unknown permission structures', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([{ _id: roleId }] as never);
    const malformedNext = vi.fn();
    const unknownNext = vi.fn();

    await rolesController.updateRole(
      makeRequest({
        params: { id: roleId },
        body: { data: { asset: 'edit' } }
      }),
      makeResponse(),
      malformedNext
    );
    await rolesController.updateRole(
      makeRequest({
        params: { id: roleId },
        body: { data: { unknownModule: { edit: false } } }
      }),
      makeResponse(),
      unknownNext
    );

    expect(malformedNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Invalid permission value: asset'
    }));
    expect(unknownNext).toHaveBeenCalledWith(expect.objectContaining({
      status: 403,
      message: 'Permission exceeds authorized scope: unknownModule'
    }));
    expect(rolesService.updateById).not.toHaveBeenCalled();
  });

  it('creates a role only for a user in the authenticated account', async () => {
    const targetUser = { _id: targetUserId, account_id: accountId, user_role: 'manager' };
    const data = { asset: { edit_asset: true } };
    const generatedRoleMenu = { assets: { view: true } };
    vi.mocked(usersService.getAllUsers).mockResolvedValue([targetUser] as never);
    vi.mocked(RoleManager.getRoleMenuData).mockResolvedValue(generatedRoleMenu);
    vi.mocked(rolesService.insertRole).mockResolvedValue({ _id: roleId } as never);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.createRole(
      makeRequest({
        body: {
          user_id: targetUserId,
          data,
          roleMenu: { attackerControlled: true },
          account_id: foreignAccountId
        }
      }),
      response,
      next
    );

    expect(usersService.getAllUsers).toHaveBeenCalledWith({
      _id: expect.objectContaining({}),
      account_id: accountId
    });
    expect(rolesService.insertRole).toHaveBeenCalledWith(
      data,
      generatedRoleMenu,
      accountId,
      expect.objectContaining({}),
      actorId
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not create a role for a foreign-account user', async () => {
    vi.mocked(usersService.getAllUsers).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.createRole(
      makeRequest({
        body: {
          user_id: targetUserId,
          data: { asset: { edit_asset: false } },
          roleMenu: {}
        }
      }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'User not found'
    }));
    expect(rolesService.insertRole).not.toHaveBeenCalled();
  });

  it('does not create a role when the target user role template is unavailable', async () => {
    vi.mocked(usersService.getAllUsers).mockResolvedValue([{
      _id: targetUserId,
      account_id: accountId,
      user_role: 'unsupported'
    }] as never);
    vi.mocked(RoleManager.getRoleMenuData).mockResolvedValue(null as never);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.createRole(
      makeRequest({
        body: {
          user_id: targetUserId,
          data: { asset: { edit_asset: false } },
          roleMenu: {}
        }
      }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'User role not found'
    }));
    expect(rolesService.insertRole).not.toHaveBeenCalled();
  });

  it('soft-deletes a role through an account-scoped service call', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([{ _id: roleId }] as never);
    vi.mocked(rolesService.removeById).mockResolvedValue({ _id: roleId } as never);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.removeRole(
      makeRequest({ params: { id: roleId } }),
      response,
      next
    );

    expect(rolesService.removeById).toHaveBeenCalledWith(roleId, accountId, actorId);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'Role deleted successfully'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not delete a role outside the authenticated account', async () => {
    vi.mocked(rolesService.getRoles).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await rolesController.removeRole(
      makeRequest({ params: { id: roleId } }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Role not found'
    }));
    expect(rolesService.removeById).not.toHaveBeenCalled();
  });
});
