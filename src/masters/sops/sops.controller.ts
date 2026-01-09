import { Request, Response, NextFunction } from 'express';
import { sopsService } from './sops.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';
import { applyRoleFilter } from '../../util/roleFilter';
import mongoose from 'mongoose';

class SOPsController {

  async getAll (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const baseFilter: any = { };
      const { query: { category, location }} = req;
      if (category) {
        baseFilter.categoryId = { $in: category.toString().split(',').filter((cat) => cat && cat.trim() !== '') };
      }
      if (location) {
        baseFilter.locationId = { $in: location.toString().split(',').filter((loc) => loc && loc.trim() !== '') };
      }
      const filter = await applyRoleFilter({ user: get(req, "user", {}) as IUser, baseFilter, mapping: 'location' });
      let data = await sopsService.getSOPs(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async getSop (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { query: { category, location }, params: { id } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Id is required'), { status: 400 });
      }
      const baseFilter: any = { _id: new mongoose.Types.ObjectId(id) };
      if (category) {
        baseFilter.categoryId = { $in: category.toString().split(',').filter((cat) => cat && cat.trim() !== '') };
      }
      if (location) {
        baseFilter.locationId = { $in: location.toString().split(',').filter((loc) => loc && loc.trim() !== '') };
      }
      const filter = await applyRoleFilter({ user: get(req, "user", {}) as IUser, baseFilter, mapping: 'location' });
      let data = await sopsService.getSOPs(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async create (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      console.log({ account_id, user_id, userRole });
      const data = await sopsService.createSOPs(req.body, account_id, user_id);
      if(!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async update (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Id is required'), { status: 400 });
      }
      const existingData = await sopsService.getSOPs({ _id: id, account_id: account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await sopsService.updateSOPs(id, body, user_id);
      if(!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async remove (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Id is required'), { status: 400 });
      }
      const existingData = await sopsService.getSOPs({ _id: id, account_id: account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await sopsService.removeSOPs(id, user_id);
      if(!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const sopsController = new SOPsController();