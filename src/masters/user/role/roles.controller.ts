import { controllerCache } from '../../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { rolesService } from './roles.service';
import { IUser } from '../../../models/user.model';
import { usersService } from '../user.service';
import { get } from 'lodash';
import { helperService } from '../../../utils/helper';
import { RoleManager } from '../../../_role/newUserRoles';

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
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { account_id: account_id, _id: helperService.validateObjectId(String(id)) };
      const existingData = await rolesService.getRoles(match);
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('Role not found'), { status: 404 });
      }
      const data = await rolesService.updateById(id, req.body, user_id);
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
      const data = await rolesService.removeById(id, user_id);
      if (!data) {
        throw Object.assign(new Error('Role not deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Role deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const rolesController = controllerCache.withCache(new RolesController(), { namespace: 'roles', ttlSeconds: 300, tags: ['roles', 'users'], readMethods: ['myRoleData'] });
