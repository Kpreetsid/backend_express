import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rolesService } from './roles.service';
import { RoleMenuModel } from '../../../models/userRoleMenu.model';
import { PlatformControlManager } from '../../../_role/userRoles';
import { RoleManager } from '../../../_role/newUserRoles';
import { applicationLogger } from '../../../observability/logger';

const roleModelMock = vi.hoisted(() => {
  const save = vi.fn();
  const Model: any = vi.fn(function (this: any, data: any) {
    Object.assign(this, data);
    this.save = save;
  });
  Model.find = vi.fn();
  Model.findOne = vi.fn();
  Model.findOneAndUpdate = vi.fn();
  return { Model, save };
});

vi.mock('../../../models/userRoleMenu.model', () => ({
  RoleMenuModel: roleModelMock.Model
}));

vi.mock('../../../_role/userRoles', () => ({
  PlatformControlManager: { getRoleMenuData: vi.fn() }
}));

vi.mock('../../../_role/newUserRoles', () => ({
  RoleManager: { getRoleMenuData: vi.fn() }
}));

vi.mock('../../../observability/logger', () => ({
  applicationLogger: { error: vi.fn() }
}));

describe('role service account-scoped writes', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const actorId = '507f1f77bcf86cd799439012';
  const roleId = '507f1f77bcf86cd799439014';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes an account-scoped role query to the model', async () => {
    const roles = [{ _id: roleId }];
    vi.mocked(RoleMenuModel.find).mockResolvedValue(roles as never);

    await expect(rolesService.getRoles({ account_id: accountId })).resolves.toBe(roles);

    expect(RoleMenuModel.find).toHaveBeenCalledWith({ account_id: accountId });
  });

  it('verifies a user role by user and account IDs', async () => {
    const role = { _id: roleId };
    vi.mocked(RoleMenuModel.findOne).mockResolvedValue(role as never);

    await expect(rolesService.verifyUserRole(actorId, accountId)).resolves.toBe(role);

    expect(RoleMenuModel.findOne).toHaveBeenCalledWith({
      user_id: expect.objectContaining({}),
      account_id: expect.objectContaining({})
    });
  });

  it('returns null for a missing or invalid verified role', async () => {
    vi.mocked(RoleMenuModel.findOne).mockResolvedValue(null);

    await expect(rolesService.verifyUserRole(actorId, accountId)).resolves.toBeNull();
    await expect(rolesService.verifyUserRole('invalid', accountId)).resolves.toBeNull();
  });

  it('constructs a new role from server-owned tenant and actor fields', async () => {
    const data = { asset: { edit_asset: true } };
    const roleMenu = { assets: { view: true } };
    const saved = { _id: roleId };
    roleModelMock.save.mockResolvedValue(saved);

    await expect(rolesService.insertRole(
      data,
      roleMenu,
      accountId,
      actorId,
      actorId
    )).resolves.toBe(saved);

    expect(roleModelMock.Model).toHaveBeenCalledWith({
      account_id: accountId,
      user_id: actorId,
      data,
      roleMenu,
      createdBy: actorId
    });
    expect(roleModelMock.save).toHaveBeenCalledWith();
  });

  it('creates default user permission data and role-menu data in the supplied session', async () => {
    const data = { asset: { edit_asset: false } };
    const roleMenu = { assets: { view: true } };
    const session = { id: 'role-session' };
    const saved = { _id: roleId };
    vi.mocked(PlatformControlManager.getRoleMenuData).mockResolvedValue(data);
    vi.mocked(RoleManager.getRoleMenuData).mockResolvedValue(roleMenu);
    roleModelMock.save.mockResolvedValue(saved);

    await expect(rolesService.createUserRole('manager', {
      _id: actorId,
      account_id: accountId
    } as any, session)).resolves.toBe(saved);

    expect(roleModelMock.Model).toHaveBeenCalledWith({
      account_id: accountId,
      user_id: actorId,
      data,
      roleMenu,
      createdBy: actorId
    });
    expect(roleModelMock.save).toHaveBeenCalledWith({ session });
  });

  it('returns null and logs when default role creation fails', async () => {
    const failure = new Error('role template unavailable');
    vi.mocked(PlatformControlManager.getRoleMenuData).mockRejectedValue(failure);

    await expect(rolesService.createUserRole('manager', {
      _id: actorId,
      account_id: accountId
    } as any)).resolves.toBeNull();

    expect(applicationLogger.error).toHaveBeenCalledWith(failure);
  });

  it('atomically scopes role data updates to the account and allowed field', async () => {
    const updated = { _id: roleId, data: { asset: { edit_asset: true } } };
    vi.mocked(RoleMenuModel.findOneAndUpdate).mockResolvedValue(updated as never);

    const result = await rolesService.updateById(
      roleId,
      accountId,
      updated.data,
      actorId
    );

    expect(RoleMenuModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: roleId, account_id: accountId },
      { $set: { data: updated.data, updatedBy: actorId } },
      { returnDocument: 'after' }
    );
    expect(result).toBe(updated);
  });

  it('atomically scopes soft deletion to the authenticated account', async () => {
    await rolesService.removeById(roleId, accountId, actorId);

    expect(RoleMenuModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: roleId, account_id: accountId },
      { $set: { updatedBy: actorId, visible: false } },
      { returnDocument: 'after' }
    );
  });
});
