import { controllerCache } from '../../../core/cache/controller-cache.service';
import { Request, Response, NextFunction } from 'express';
import { rolesService } from '../services/roles.service';
import { IUser } from '../models/user.model';
import { usersService } from '../services/user.service';
import { get } from 'lodash';
import { helperService } from '../../../common/utils/object-id.helper';
import { RoleManager } from '../../../common/constants/new-user-roles.constant';
import { PlatformControlManager } from '../../../common/constants/roles.constant';
import { TokenModel } from '../../auth/models/userToken.model';
import { clearAuthSessionCacheForUser } from '../../../core/auth/auth.middleware';
import { companyService } from '../../company/services/company.service';
import { accountAccessService } from '../services/account-access.service';

const getAccountRoleMenuOrThrow = async (accountId: unknown) => {
  const account = await companyService.verifyCompany(String(accountId));
  if (!account) {
    throw Object.assign(new Error('Account not found'), { status: 404 });
  }
  return accountAccessService.getAccountRoleMenu(account);
};

const getConfigurableRoles = async (accountId: unknown, roles: any[]) => {
  const accountRoleMenu = await getAccountRoleMenuOrThrow(accountId);
  return roles.map((role: any) => accountAccessService.toConfigurableRole(role, accountRoleMenu));
};

class RolesController {
  constructor() {
    this.getAll = this.getAll.bind(this);
    this.myRoleData = this.myRoleData.bind(this);
    this.getDataById = this.getDataById.bind(this);
    this.createRole = this.createRole.bind(this);
    this.updateRole = this.updateRole.bind(this);
    this.removeRole = this.removeRole.bind(this);
    this.assertAdminOrManager = this.assertAdminOrManager.bind(this);
    this.getRoleRecord = this.getRoleRecord.bind(this);
    this.getTargetUser = this.getTargetUser.bind(this);
    this.revokeUserSessions = this.revokeUserSessions.bind(this);
  }
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      this.assertAdminOrManager(user);
      const { user_id: queryUserId } = req.query;
      const match: any = { account_id: user.account_id };

      if (queryUserId) {
        match.user_id = helperService.validateObjectId(String(queryUserId));
      }
      let data = await rolesService.getRoles(match);
      if ((!data || data.length === 0) && queryUserId) {
        const targetUsers = await usersService.getAllUsers({ _id: match.user_id, account_id: user.account_id });
        if (targetUsers.length > 0) {
          const bootstrapped = await rolesService.createUserRole(targetUsers[0].user_role, targetUsers[0]);
          data = [bootstrapped];
        }
      }
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }

      const configurableRoles = await getConfigurableRoles(user.account_id, data);
      res.status(200).json({ status: true, message: 'Roles fetched successfully', data: configurableRoles });
    } catch (error) {
      next(error);
    }
  }

  async myRoleData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, 'user', {}) as IUser;
      const data = await rolesService.getRoles({ account_id, user_id });
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }
      const configurableRoles = await getConfigurableRoles(account_id, data);
      res.status(200).json({ status: true, message: 'Role fetched successfully', data: configurableRoles });
    } catch (error) {
      next(error);
    }
  }

  async getDataById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      this.assertAdminOrManager(user);
      const data = await this.getRoleRecord(String(req.params.id), user.account_id);
      const configurableRoles = await getConfigurableRoles(user.account_id, [data]);
      res.status(200).json({ status: true, message: 'Role fetched successfully', data: configurableRoles });
    } catch (error) {
      next(error);
    }
  }

  async createRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const actor = get(req, 'user', {}) as IUser;
      this.assertAdminOrManager(actor);
      const targetUserId = helperService.validateObjectId(String(req.body.user_id));
      const targetUser = await this.getTargetUser(targetUserId, actor.account_id);
      const existingRole = await rolesService.getRoles({ account_id: actor.account_id, user_id: targetUserId });
      if (existingRole.length) {
        throw Object.assign(new Error('A role configuration already exists for this user'), { status: 409 });
      }

      const [data, roleMenu] = await Promise.all([
        PlatformControlManager.getRoleMenuData(targetUser.user_role),
        RoleManager.getRoleMenuData(targetUser.user_role)
      ]);
      const createdRole = await rolesService.insertRole(
        { data, roleMenu },
        actor.account_id,
        targetUserId,
        actor._id
      );
      if (!createdRole) {
        throw Object.assign(new Error('Role not created'), { status: 500 });
      }
      res.status(200).json({ status: true, message: 'Role created successfully', data: createdRole });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const actor = get(req, 'user', {}) as IUser;
      this.assertAdminOrManager(actor);
      const existingRole: any = await this.getRoleRecord(String(req.params.id), actor.account_id);
      const targetUser = await this.getTargetUser(existingRole.user_id, actor.account_id);
      if (targetUser.isFirstUser) {
        throw Object.assign(new Error('The primary account administrator permissions cannot be changed'), { status: 400 });
      }

      const accountRoleMenu = await getAccountRoleMenuOrThrow(actor.account_id);
      const data = accountAccessService.mergeConfigurablePlatformControl(
        existingRole.data,
        req.body.data,
        accountRoleMenu
      );
      const updatedRole = await rolesService.updateById(
        existingRole._id,
        actor.account_id,
        data,
        actor._id
      );
      if (!updatedRole) {
        throw Object.assign(new Error('Role not updated'), { status: 404 });
      }
      await this.revokeUserSessions(existingRole.user_id);
      res.status(200).json({ status: true, message: 'Role updated successfully. The user must sign in again.', data: updatedRole });
    } catch (error) {
      next(error);
    }
  }

  async removeRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const actor = get(req, 'user', {}) as IUser;
      this.assertAdminOrManager(actor);
      const existingRole: any = await this.getRoleRecord(String(req.params.id), actor.account_id);
      const targetUser = await this.getTargetUser(existingRole.user_id, actor.account_id);
      if (targetUser.isFirstUser) {
        throw Object.assign(new Error('The primary account administrator role cannot be removed'), { status: 400 });
      }

      const removedRole = await rolesService.removeById(existingRole._id, actor.account_id);
      if (!removedRole) {
        throw Object.assign(new Error('Role not deleted'), { status: 404 });
      }
      await this.revokeUserSessions(existingRole.user_id);
      res.status(200).json({ status: true, message: 'Role deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  private assertAdminOrManager(user: IUser): void {
    const role = String(user?.user_role || '').trim().toLowerCase();
    if (!user?._id || !['admin', 'super_admin', 'manager'].includes(role)) {
      throw Object.assign(new Error('Account administrator access is required'), { status: 403 });
    }
  }

  private async getRoleRecord(id: string, accountId: any): Promise<any> {
    const objectId = helperService.validateObjectId(String(id));
    const data = await rolesService.getRoles({
      account_id: accountId,
      $or: [{ _id: objectId }, { user_id: objectId }]
    });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('Role not found'), { status: 404 });
    }
    return data[0];
  }

  private async getTargetUser(userId: any, accountId: any): Promise<any> {
    const users = await usersService.getAllUsers({
      _id: helperService.validateObjectId(String(userId)),
      account_id: accountId
    });
    if (!users.length) {
      throw Object.assign(new Error('User not found in this account'), { status: 404 });
    }
    return users[0];
  }

  private async revokeUserSessions(userId: any): Promise<void> {
    await TokenModel.deleteMany({ userId });
    clearAuthSessionCacheForUser(String(userId));
  }
}

export const rolesController = controllerCache.withCache(new RolesController(), { namespace: 'roles', ttlSeconds: 300, tags: ['roles', 'users'] });
