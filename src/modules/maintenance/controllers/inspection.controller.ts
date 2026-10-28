import { controllerCache } from '../../../core/cache/controller-cache.service';
import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../users/models/user.model';
import { inspectionService } from '../services/inspection.service';
import { mapInspectionService } from '../../mappings/services/userInspection.service';
import { helperService } from '../../../common/utils/helper';
import { notificationService } from '../../communications/services/notification-sender.service';

class InspectionController {
 private async assertInspectionAccess(accountId: any, userId: any, userRole: string, inspectionId: any): Promise<void> {
  if (userRole === 'admin') return;
  const mappings: any[] = await mapInspectionService.getInspectionByUserId(accountId, userId);
  const allowed = mappings.some((mapping: any) => String(mapping?.inspection_id) === String(inspectionId));
  if (!allowed) {
    throw Object.assign(new Error('Inspection not found or unauthorized'), { status: 404 });
  }
 }


 async getAll (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    const { query: { location_id, asset_id } } = req;
    if (location_id) {
      match.location_id = { $in: helperService.validateObjectIds(location_id.toString()) };
    }
    if (asset_id) {
      match.asset_id = { $in: helperService.validateObjectIds(asset_id.toString()) };
    }
    if (userRole !== 'admin') {
      const inspectionMappedData: any = await mapInspectionService.getInspectionByUserId(account_id, user_id);
      match._id = { $in: inspectionMappedData.map((doc: any) => doc.inspection_id) };
    }
    const data = await inspectionService.getAllInspection(match);
    if (!data.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspections fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

 async getById (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    const inspectionId = helperService.validateObjectId(id);
    await this.assertInspectionAccess(account_id, user_id, userRole, inspectionId);
    const data = await inspectionService.getAllInspection({ _id: inspectionId, account_id, visible: true });
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
    const inspectionId = helperService.validateObjectId(id);
    await this.assertInspectionAccess(account_id, user_id, userRole, inspectionId);
    const data = await inspectionService.updateInspection(inspectionId, req.body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('Inspection not updated'), { status: 404 });
    }
    const result = await inspectionService.getAllInspection({ _id: inspectionId, account_id, visible: true });
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
    const inspectionId = helperService.validateObjectId(id);
    await this.assertInspectionAccess(account_id, user_id, userRole, inspectionId);
    const data = await inspectionService.getAllInspection({ _id: inspectionId, account_id, visible: true });
    if (!data.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    const result = await inspectionService.removeInspection(inspectionId, account_id, user_id);
    if (!result) {
      throw Object.assign(new Error('Inspection not deleted'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspection deleted successfully" });
  } catch (error) {
    next(error);
  }
};

 async createCorrectiveWorkOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const user = get(req, "user", {}) as IUser;
    const { account_id, _id: user_id, user_role: userRole } = user;
    const inspectionId = helperService.validateObjectId(req.params.id);
    await this.assertInspectionAccess(account_id, user_id, userRole, inspectionId);
    const data: any = await inspectionService.createCorrectiveWorkOrder(
      inspectionId,
      String(req.body?.finding_key || ''),
      req.body,
      user
    );
    res.status(201).json({
      status: true,
      message: 'Corrective work order created successfully',
      data
    });
  } catch (error) {
    next(error);
  }
 };

}

export const inspectionController = controllerCache.withCache(new InspectionController(), { namespace: 'inspections', ttlSeconds: 300, tags: ['inspections', 'assets', 'locations'] });
