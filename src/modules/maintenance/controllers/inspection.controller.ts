import { controllerCache } from '../../../core/cache/controller-cache.service';
import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../users/models/user.model';
import { inspectionService } from '../services/inspection.service';
import { mapInspectionService } from '../../mappings/services/userInspection.service';
import { helperService } from '../../../common/utils/object-id.helper';
import { notificationService } from '../../communications/services/notification-sender.service';

class InspectionController {

 async getAll (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    const { query: { location_id, asset_id } } = req;
    if (location_id) {
      match.location_id = { $in: helperService.validateObjectIds(location_id, 100) };
    }
    if (asset_id) {
      match.asset_id = { $in: helperService.validateObjectIds(asset_id, 100) };
    }
    if (userRole !== 'admin') match._id = { $in: await this.getAccessibleInspectionIds(account_id, user_id) };
    const data = await inspectionService.getAllInspection(match);
    res.status(200).json({ status: true, message: "Inspections fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

 async getById (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    await this.assertInspectionAccess(String(id), account_id, user_id, userRole);
    const match: any = { _id: helperService.validateObjectId(String(id)), account_id, visible: true };
    const data = await inspectionService.getAllInspection(match);
    if (!data.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspection fetched successfully", data: data[0] });
  } catch (error) {
    next(error);
  }
};

 async create (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const data: any = await inspectionService.createInspection(req.body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('Inspection not created'), { status: 404 });
    }
    const result = await inspectionService.getAllInspection({ _id: data._id, account_id, visible: true });
    if (!result.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    await notificationService.notifyAccountUsers({
      accountId: String(account_id),
      module: 'Inspection',
      event: 'created',
      entityId: String(data._id),
      entityName: result[0].title,
      actionUrl: `/inspections/1/${data._id}`,
      sourceUserId: String(user_id)
    });
    res.status(201).json({ status: true, message: "Inspection created successfully", data: result });
  } catch (error) {
    next(error);
  }
};

 async updateById (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    await this.assertInspectionAccess(String(id), account_id, user_id, userRole);
    const data = await inspectionService.updateInspection(helperService.validateObjectId(id), req.body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('Inspection not updated'), { status: 404 });
    }
    const result = await inspectionService.getAllInspection({ _id: helperService.validateObjectId(id), account_id, visible: true });
    if (!result.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    await notificationService.notifyAccountUsers({
      accountId: String(account_id),
      module: 'Inspection',
      event: 'updated',
      entityId: String(id),
      entityName: result[0].title,
      actionUrl: `/inspections/1/${id}`,
      sourceUserId: String(user_id)
    });
    res.status(200).json({ status: true, message: "Inspection updated successfully", data: result });
  } catch (error) {
    next(error);
  }
};

 async removeById (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    await this.assertInspectionAccess(String(id), account_id, user_id, userRole);
    const data = await inspectionService.getAllInspection({ _id: helperService.validateObjectId(id), account_id, visible: true });
    if (!data.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    const result = await inspectionService.removeInspection(helperService.validateObjectId(id), account_id, user_id);
    if (!result) {
      throw Object.assign(new Error('Inspection not deleted'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspection deleted successfully" });
  } catch (error) {
    next(error);
  }
 };

 private async getAccessibleInspectionIds(accountId: any, userId: any): Promise<any[]> {
  const mappings: any = await mapInspectionService.getInspectionByUserId(accountId, userId);
  return mappings.map((doc: any) => doc.inspection_id);
 }

 private async assertInspectionAccess(id: string, accountId: any, userId: any, userRole: string): Promise<void> {
  if (userRole === 'admin') return;
  const allowedIds = await this.getAccessibleInspectionIds(accountId, userId);
  if (!allowedIds.some((allowedId: any) => String(allowedId) === String(id))) {
    throw Object.assign(new Error('Inspection not found'), { status: 404 });
  }
 }
}

export const inspectionController = controllerCache.withCache(new InspectionController(), { namespace: 'inspections', ttlSeconds: 300, tags: ['inspections', 'assets', 'locations'] });
