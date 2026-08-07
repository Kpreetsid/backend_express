import { NextFunction, Request, Response } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { orderTemplateService } from './orderTemplate.service';

class OrderTemplateController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const match: any = { account_id: user.account_id };
      const search = String(req.query.search || '').trim();
      const maintenanceType = String(req.query.maintenance_type || '').trim();

      if (search && search !== 'undefined' && search !== 'null') {
        match.$or = [
          { template_name: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (maintenanceType && maintenanceType !== 'undefined' && maintenanceType !== 'null') {
        match.maintenance_type = maintenanceType;
      }

      const data = await orderTemplateService.getAllTemplates(match);
      res.status(200).json({ status: true, message: 'Work order templates fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await orderTemplateService.getTemplateById(String(req.params.id), user.account_id);
      if (!data) {
        throw Object.assign(new Error('Work order template not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: 'Work order template fetched successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await orderTemplateService.createTemplate(req.body, user.account_id, user._id);
      res.status(201).json({ status: true, message: 'Work order template created successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await orderTemplateService.updateTemplate(String(req.params.id), req.body, user.account_id, user._id);
      if (!data) {
        throw Object.assign(new Error('Work order template not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: 'Work order template updated successfully.', data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const data = await orderTemplateService.removeTemplate(String(req.params.id), user.account_id, user._id);
      if (!data) {
        throw Object.assign(new Error('Work order template not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: 'Work order template deleted successfully.' });
    } catch (error) {
      next(error);
    }
  }
}

export const orderTemplateController = new OrderTemplateController();
