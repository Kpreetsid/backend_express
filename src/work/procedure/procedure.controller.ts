import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { procedureService } from './procedure.service';
import { helperService } from '../../utils/helper';

class ProcedureController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const match: any = { account_id: user.account_id };
      const search = String(req.query['search'] || '').trim();
      const category = String(req.query['category'] || '').trim();
      const tag = String(req.query['tag'] || '').trim();
      const locationId = req.query['location_id'];
      const assetId = req.query['asset_id'];
      const includeHistory = String(req.query['include_history'] || '').trim() === 'true';
      if (search && search !== 'undefined' && search !== 'null') {
        match.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { tags: { $regex: search, $options: 'i' } }
        ];
      }
      if (category && category !== 'undefined' && category !== 'null') {
        match.category = category;
      }
      if (tag && tag !== 'undefined' && tag !== 'null') {
        match.tags = tag;
      }
      if (locationId && String(locationId).trim() && String(locationId).trim() !== 'undefined' && String(locationId).trim() !== 'null') {
        match.location_ids = { $in: helperService.validateObjectIds(locationId) };
      }
      if (assetId && String(assetId).trim() && String(assetId).trim() !== 'undefined' && String(assetId).trim() !== 'null') {
        match.asset_ids = { $in: helperService.validateObjectIds(assetId) };
      }
      const data = await procedureService.getAllProcedures(match, { includeHistory });
      res.status(200).json({ status: true, message: 'Procedures fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const procedureId = helperService.validateObjectId(String(req.params['id']));
      const data = await procedureService.getProcedureById(String(procedureId), user.account_id);
      if (!data) {
        throw Object.assign(new Error('Procedure not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: 'Procedure fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await procedureService.createProcedure(req.body, user.account_id, user._id);
      res.status(201).json({ status: true, message: 'Procedure created successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await procedureService.updateProcedure(String(req.params['id']), req.body, user.account_id, user._id);
      if (!data) {
        throw Object.assign(new Error('Procedure not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: 'Procedure updated successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await procedureService.removeProcedure(String(req.params['id']), user.account_id, user._id);
      if (!data) {
        throw Object.assign(new Error('Procedure not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: 'Procedure deleted successfully.' });
    } catch (error) {
      next(error);
    }
  }
}

export const procedureController = new ProcedureController();
