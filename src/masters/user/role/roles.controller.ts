import { Request, Response, NextFunction } from 'express';
import { rolesService } from './roles.service';
import { IUser } from '../../../models/user.model';
import { usersService } from '../user.service';
import { get } from 'lodash';
import { helperService } from '../../../utils/helper';
import { RoleManager } from '../../../_role/newUserRoles';

const assertPermissionCeiling = (
  requested: Record<string, unknown>,
  effective: Record<string, unknown>,
  path = ''
): void => {
  for (const [key, value] of Object.entries(requested)) {
    const permissionPath = path ? `${path}.${key}` : key;
    const effectiveValue = effective?.[key];
    if (typeof value === 'boolean') {
      if (!(key in effective) || (value && effectiveValue !== true)) {
        throw Object.assign(new Error(`Permission exceeds authorized scope: ${permissionPath}`), { status: 403 });
      }
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw Object.assign(new Error(`Invalid permission value: ${permissionPath}`), { status: 400 });
    }
    if (!effectiveValue || typeof effectiveValue !== 'object' || Array.isArray(effectiveValue)) {
      throw Object.assign(new Error(`Permission exceeds authorized scope: ${permissionPath}`), { status: 403 });
    }
    assertPermissionCeiling(
      value as Record<string, unknown>,
      effectiveValue as Record<string, unknown>,
      permissionPath
    );
  }
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
      res.status(200).json({ status: true, message: "Roles fetched successfully", data });
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
      res.status(200).json({ status: true, message: "Role fetched successfully", data });
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
      res.status(200).json({ status: true, message: "Role fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async createRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: actor_user_id } = get(req, "user", {}) as IUser;
      const targetUserId = helperService.validateObjectId(String(req.body.user_id));
      const userData: any = await usersService.getAllUsers({ _id: targetUserId, account_id });
      if (!userData || userData.length === 0) {
        throw Object.assign(new Error('User not found'), { status: 404 });
      }
      const newRoleMenu = await RoleManager.getRoleMenuData(userData[0].user_role);
      if (!newRoleMenu) {
        throw Object.assign(new Error('User role not found'), { status: 404 });
      }
      assertPermissionCeiling(req.body.data, get(req, "role", {}) as Record<string, unknown>);
      const data = await rolesService.insertRole(
        req.body.data,
        newRoleMenu,
        account_id,
        targetUserId,
        actor_user_id
      );
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
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { account_id: account_id, _id: helperService.validateObjectId(String(id)) };
      const existingData = await rolesService.getRoles(match);
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }
      assertPermissionCeiling(req.body.data, get(req, "role", {}) as Record<string, unknown>);
      const data = await rolesService.updateById(id, account_id, req.body.data, user_id);
      if (!data) {
        throw Object.assign(new Error('Role not updated'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Role updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async removeRole(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { account_id: account_id, _id: helperService.validateObjectId(String(id)) };
      const existingData = await rolesService.getRoles(match);
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }
      const data = await rolesService.removeById(id, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('Role not deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Role deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const rolesController = new RolesController();
