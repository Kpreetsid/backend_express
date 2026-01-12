import { Request, Response, NextFunction } from 'express';
import { rolesService } from './roles.service';
import { IUser } from '../../../models/user.model';
import { get } from 'lodash';
import mongoose from 'mongoose';

class RolesController {
  async getAll (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { query: { user_id: queryUserId } } = req;
      const match: any = { account_id };
      if (queryUserId) {
        match.user_id = new mongoose.Types.ObjectId(`${queryUserId}`);
      }
      const data = await rolesService.getRoles(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async myRoleData (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id, user_id };
      const data = await rolesService.getRoles(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async getDataById (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('ID is required'), { status: 400 });
      }
      const match: any = { account_id: account_id, _id: id };
      const data = await rolesService.getRoles(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async createRole (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const data = await rolesService.insertRole(req.body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async updateRole (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('ID is required'), { status: 400 });
      }
      const match: any = { account_id: account_id, _id: new mongoose.Types.ObjectId(`${id}`) };
      const existingData = await rolesService.getRoles(match);
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await rolesService.updateById(id, req.body, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async removeRole (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('ID is required'), { status: 400 });
      }
      const match: any = { account_id: account_id, _id: new mongoose.Types.ObjectId(`${id}`) };
      const existingData = await rolesService.getRoles(match);
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await rolesService.removeById(id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const rolesController = new RolesController();