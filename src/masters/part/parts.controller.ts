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
        throw Object.assign(new Error('No parts found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Parts retrieved successfully", data });
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
      res.status(200).json({ status: true, message: "Part retrieved successfully", data: data[0] });
    } catch (error) {
      next(error);
    }
  }

  async createPart(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const createdData = await partsService.insert(req.body, account_id, user_id);
      
      // Fetch populated data
      const data = await partsService.getAllParts({ _id: createdData._id });
      const result = data && data.length > 0 ? data[0] : createdData;
      
      res.status(201).json({ status: true, message: "Part created successfully", data: result });
    } catch (error) {
      next(error);
    }
  }

  async importParts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const rawParts = req.body?.parts;
      let parts: any[] = [];

      if (typeof rawParts === 'string') {
        parts = JSON.parse(rawParts);
      } else if (Array.isArray(rawParts)) {
        parts = rawParts;
      }

      if (!Array.isArray(parts) || parts.length === 0) {
        throw Object.assign(new Error('Import file contains no valid parts data'), { status: 400 });
      }

      const result = await partsService.importParts(parts, account_id, user_id);
      const file = req.file ? {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null;

      res.status(201).json({
        status: result.imported > 0,
        message: result.failed
          ? `Imported ${result.imported} out of ${result.total} parts.`
          : `Successfully imported ${result.imported} parts.`,
        data: result,
        file
      });
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

      const updated = await partsService.updatePartById(String(id), body, user_id);
      if (!updated) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }

      // Fetch populated data
      const data = await partsService.getAllParts({ _id: helperService.validateObjectId(String(id)) });

      res.status(200).json({ status: true, message: "Part updated successfully", data: data[0] });
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
      
      const currentPart = part[0];
      const updatedQuantity = Number(currentPart.quantity) + Number(quantity);
      
      const updatedPart = await partsService.updatePartStock(String(id), { quantity: updatedQuantity }, user_id);
      if (!updatedPart) {
        throw Object.assign(new Error('Part not found'), { status: 404 });
      }

      // Fetch populated data
      const data = await partsService.getAllParts({ _id: helperService.validateObjectId(String(id)) });

      res.status(200).json({ status: true, message: "Part stock updated successfully", data: data[0] });
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
