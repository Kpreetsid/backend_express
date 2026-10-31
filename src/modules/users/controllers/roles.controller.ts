import { Request, Response, NextFunction } from 'express';
import { rolesService } from '@modules/users/services/roles.service';
import { IUser } from '@modules/users/models/user.model';
import { usersService } from '@modules/users/services/user.service';
import { get } from 'lodash';
import { helperService } from '@common/utils/helper';
import { RoleManager } from '@common/constants/new-user-roles.constant';
import { companyService } from '@modules/company/services/company.service';
import { accountAccessService } from '@modules/users/services/account-access.service';

const getAccountRoleMenuOrThrow = async (accountId: unknown) => {
  const account = await companyService.verifyCompany(String(accountId));
  if (!account) {
    throw Object.assign(new Error('Account not found'), { status: 404 });
  }
  return accountAccessService.getAccountRoleMenu(account);
};

const getRoleTargetUserOrThrow = async (accountId: unknown, role: any) => {
  const users = await usersService.getAllUsers({ _id: role?.user_id, account_id: accountId });
  if (!users || users.length === 0) {
    throw Object.assign(new Error('Role target user not found'), { status: 404 });
  }
  return users[0];
};

const getConfigurableRoles = async (accountId: unknown, roles: any[]) => {
  const accountRoleMenu = await getAccountRoleMenuOrThrow(accountId);
  const userIds = roles.map((role: any) => role?.user_id).filter(Boolean);
  const users = userIds.length
    ? await usersService.getAllUsers({ _id: { $in: userIds }, account_id: accountId })
    : [];
  const usersById = new Map(users.map((user: any) => [String(user._id), user]));

  return await Promise.all(roles.map(async (role: any) => {
    const targetUser = usersById.get(String(role?.user_id || ''));
    return targetUser
      ? await accountAccessService.toConfigurableRoleForUser(targetUser, role, accountRoleMenu)
      : accountAccessService.toConfigurableRole(role, accountRoleMenu);
  }));
};

class RolesController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { query: { user_id: queryUserId } } = req;
      const match: any = { account_id };
      if (queryUserId) {
        match.user_id = helperService.validateObjectId(String(queryUserId));
      }
      const data = await rolesService.getRoles(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }
      const configurableRoles = await getConfigurableRoles(account_id, data);
      res.status(200).json({ status: true, message: "Roles fetched successfully", data: configurableRoles });
    } catch (error) {
      next(error);
    }
  }

  async myRoleData(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id, user_id };
      const data = await rolesService.getRoles(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }
      res.status(200).json({
        status: true,
        message: "Role fetched successfully",
        data: await getConfigurableRoles(account_id, data)
      });
    } catch (error) {
      next(error);
    }
  }

  async getDataById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { account_id: account_id, _id: helperService.validateObjectId(String(id)) };
      const data = await rolesService.getRoles(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }
      res.status(200).json({
        status: true,
        message: "Role fetched successfully",
        data: await getConfigurableRoles(account_id, data)
      });
    } catch (error) {
      next(error);
    }
  }

  async createRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userData: any = await usersService.getAllUsers({ _id: helperService.validateObjectId(String(user_id)) });
      if (!userData || userData.length === 0) {
        throw Object.assign(new Error('User not found'), { status: 404 });
      }
      const newRoleMenu = await RoleManager.getRoleMenuData(userData[0].user_role);
      if (!newRoleMenu) {
        throw Object.assign(new Error('User role not found'), { status: 404 });
      }
      req.body.roleMenu = newRoleMenu;
      const data = await rolesService.insertRole(req.body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('Role not created'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Role created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const actor = get(req, "user", {}) as IUser;
      const { account_id, _id: user_id } = actor;
      const { params: { id } } = req;
      const match: any = { account_id: account_id, _id: helperService.validateObjectId(String(id)) };
      const existingData = await rolesService.getRoles(match);
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }

      const targetUser: any = await getRoleTargetUserOrThrow(account_id, existingData[0]);
      if (targetUser.isFirstUser === true) {
        throw Object.assign(new Error('First user permissions cannot be modified'), { status: 403 });
      }
      if (targetUser.user_role === 'admin' && actor.user_role !== 'admin') {
        throw Object.assign(new Error('You cannot modify an administrator permission profile'), { status: 403 });
      }
      if (!accountAccessService.canDelegatePlatformControl((req as any).role || {}, req.body?.data || {})) {
        throw Object.assign(new Error('You cannot grant permissions outside your effective access'), { status: 403 });
      }

      const accountRoleMenu = await getAccountRoleMenuOrThrow(account_id);
      const roleDataWithDefaults = await accountAccessService.getRoleDataWithDefaultsForUser(targetUser, existingData[0]);
      const data = await rolesService.updateById(id, {
        data: accountAccessService.mergeConfigurablePlatformControl(
          roleDataWithDefaults.data,
          req.body.data,
          accountRoleMenu
        )
      }, user_id);
      if (!data) {
        throw Object.assign(new Error('Role not updated'), { status: 404 });
      }

      await usersService.revokeAuthorizationSessions(targetUser._id, account_id);
      res.status(200).json({ status: true, message: "Role updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async removeRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const actor = get(req, "user", {}) as IUser;
      const { account_id, _id: user_id } = actor;
      const { params: { id } } = req;
      const match: any = { account_id: account_id, _id: helperService.validateObjectId(String(id)) };
      const existingData = await rolesService.getRoles(match);
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }

      const targetUser: any = await getRoleTargetUserOrThrow(account_id, existingData[0]);
      if (targetUser.isFirstUser === true) {
        throw Object.assign(new Error('First user permissions cannot be removed'), { status: 403 });
      }
      if (targetUser.user_role === 'admin' && actor.user_role !== 'admin') {
        throw Object.assign(new Error('You cannot modify an administrator permission profile'), { status: 403 });
      }

      const data = await rolesService.removeById(id, user_id);
      if (!data) {
        throw Object.assign(new Error('Role not deleted'), { status: 404 });
      }
      await usersService.revokeAuthorizationSessions(targetUser._id, account_id);
      res.status(200).json({ status: true, message: "Role deleted successfully", data });
    } catch (error) {
      next(error);
    }
  }
}

export const rolesController = new RolesController();
