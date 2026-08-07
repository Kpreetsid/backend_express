import { Request, Response, NextFunction } from 'express';
import { sopsService } from './sops.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';
import { applyRoleFilter } from '../../utils/roleFilter';
import { helperService } from '../../utils/helper';

class SOPsController {

  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const baseFilter: any = {};
      const { query: { category, location } } = req;
      if (category) {
        baseFilter.categoryId = { $in: helperService.validateObjectIds(category.toString()) };
      }
      if (location) {
        baseFilter.locationId = { $in: helperService.validateObjectIds(location.toString()) };
      }
      const filter = await applyRoleFilter({ user: get(req, "user", {}) as IUser, baseFilter, mapping: 'location', idField: "locationId" });
      let data = await sopsService.getSOPs(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('SOPs not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "SOPs fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getSop(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { query: { category, location }, params: { id } } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)) };
      if (category) {
        baseFilter.categoryId = { $in: helperService.validateObjectIds(category.toString()) };
      }
      if (location) {
        baseFilter.locationId = { $in: helperService.validateObjectIds(location.toString()) };
      }
      const filter = await applyRoleFilter({ user: get(req, "user", {}) as IUser, baseFilter, mapping: 'location', idField: "locationId" });
      let data = await sopsService.getSOPs(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('SOP not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "SOP fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      console.log({ account_id, user_id, userRole });
      const data = await sopsService.createSOPs(req.body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('SOP not created'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "SOP created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const existingData = await sopsService.getSOPs({ _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('SOP not found'), { status: 404 });
      }
      const data = await sopsService.updateSOPs(id, body, user_id);
      if (!data) {
        throw Object.assign(new Error('SOP not updated'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "SOP updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const existingData = await sopsService.getSOPs({ _id: helperService.validateObjectId(String(id)), account_id: account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('SOP not found'), { status: 404 });
      }
      const data = await sopsService.removeSOPs(id, user_id);
      if (!data) {
        throw Object.assign(new Error('SOP not deleted'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: "SOP deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const sopsController = new SOPsController();