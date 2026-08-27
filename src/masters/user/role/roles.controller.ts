import { controllerCache } from '../../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { rolesService } from './roles.service';
import { IUser } from '../../../models/user.model';
import { usersService } from '../user.service';
import { get } from 'lodash';
import { helperService } from '../../../utils/helper';
import { RoleManager } from '../../../_role/newUserRoles';

import { PlatformControlManager } from '../../../_role/userRoles';
import { TokenModel } from '../../../models/userToken.model';
import { clearAuthSessionCacheForUser } from '../../../_config/auth';
import { sanitizePermissionPatch } from './permissionPolicy';


class RolesController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {

      const user = get(req, 'user', {}) as IUser;
      this.assertAccountAdmin(user);
      const { user_id: queryUserId } = req.query;
      const match: any = { account_id: user.account_id };

      if (queryUserId) {
        match.user_id = helperService.validateObjectId(String(queryUserId));
      }
      const data = await rolesService.getRoles(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }

      res.status(200).json({ status: true, message: 'Roles fetched successfully', data });

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
      res.status(200).json({ status: true, message: 'Role fetched successfully', data });

    } catch (error) {
      next(error);
    }
  }

  async getDataById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {

      const user = get(req, 'user', {}) as IUser;
      this.assertAccountAdmin(user);
      const data = await this.getRoleRecord(String(req.params.id), user.account_id);
      res.status(200).json({ status: true, message: 'Role fetched successfully', data: [data] });

    } catch (error) {
      next(error);
    }
  }

  async createRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {

      const actor = get(req, 'user', {}) as IUser;
      this.assertAccountAdmin(actor);
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
      this.assertAccountAdmin(actor);
      const existingRole: any = await this.getRoleRecord(String(req.params.id), actor.account_id);
      const targetUser = await this.getTargetUser(existingRole.user_id, actor.account_id);
      if (targetUser.isFirstUser) {
        throw Object.assign(new Error('The primary account administrator permissions cannot be changed'), { status: 400 });
      }

      const data = sanitizePermissionPatch(existingRole.data, req.body.data);
      const updatedRole = await rolesService.updateById(
        req.params.id,
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
      this.assertAccountAdmin(actor);
      const existingRole: any = await this.getRoleRecord(String(req.params.id), actor.account_id);
      const targetUser = await this.getTargetUser(existingRole.user_id, actor.account_id);
      if (targetUser.isFirstUser) {
        throw Object.assign(new Error('The primary account administrator role cannot be removed'), { status: 400 });
      }

      const removedRole = await rolesService.removeById(req.params.id, actor.account_id);
      if (!removedRole) {
        throw Object.assign(new Error('Role not deleted'), { status: 404 });
      }
      await this.revokeUserSessions(existingRole.user_id);
      res.status(200).json({ status: true, message: 'Role deleted successfully' });

    } catch (error) {
      next(error);
    }
  }


  private assertAccountAdmin(user: IUser): void {
    if (!user?._id || user.user_role !== 'admin') {
      throw Object.assign(new Error('Account administrator access is required'), { status: 403 });
    }
  }

  private async getRoleRecord(id: string, accountId: any): Promise<any> {
    const data = await rolesService.getRoles({
      account_id: accountId,
      _id: helperService.validateObjectId(String(id))
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
