import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { partsService } from './parts.service';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';

class PartsController {

  async getParts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const baseFilter: any = { account_id, visible: true };
      const { query: { id, location_id } } = req;
      if (id) {
        baseFilter._id = { $in: helperService.validateObjectIds(String(id)) };
      }
      if (location_id) {
        baseFilter.location_id = { $in: helperService.validateObjectIds(String(location_id)) };
      }

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "location_id"
      });

      const data = await partsService.getAllParts(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Parts fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getPart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id } } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };

      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "location",
        idField: "location_id"
      });

      const data = await partsService.getAllParts(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Part fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async createPart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const data = await partsService.insert(req.body, account_id, user_id);
      res.status(201).json({ status: true, message: "Part created successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async updatePart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };
      const isDataExists = await partsService.getAllParts(match);
      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      const data = await partsService.updatePartById(String(id), body, user_id);
      if (!data) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Part updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async updateStock(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body: { quantity } } = req;
      const part = await partsService.getAllParts({ _id: helperService.validateObjectId(String(id)), account_id, visible: true });
      if (!part || part.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      part[0].quantity = Number(part[0].quantity) + Number(quantity);
      const updatedPart = await partsService.updatePartStock(String(id), part[0], user_id);
      if (!updatedPart) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Part stock updated successfully", data: updatedPart });
    } catch (error) {
      next(error);
    }
  };

  async removePart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };
      const isDataExists = await partsService.getAllParts(match);
      if (!isDataExists || isDataExists.length === 0) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      const data = await partsService.removeById(String(id), user_id);
      if (!data) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Part deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const partsController = new PartsController();