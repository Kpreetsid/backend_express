import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../models/user.model';
import { inspectionService } from './inspection.service';
import mongoose from 'mongoose';
import { mapInspectionService } from '../transaction/mapUserInspection/userInspection.service';

class InspectionController {

 async getAll (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    const { query: { location_id, asset_id } } = req;
    if (location_id) {
      match.location_id = location_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(String(id)));
    }
    if (asset_id) {
      match.asset_id = asset_id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(String(id)));
    }
    if (userRole !== 'admin') {
      const inspectionMappedData: any = await mapInspectionService.getInspectionByUserId(account_id, user_id);
      match._id = { $in: inspectionMappedData.map((doc: any) => doc.inspection_id) };
    }
    const data = await inspectionService.getAllInspection(match);
    if (!data.length) {
      throw Object.assign(new Error('No inspections data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspections fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

 async getById (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    const data = await inspectionService.getAllInspection({ _id: id, account_id, visible: true });
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
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    const result = await inspectionService.getAllInspection({ _id: data._id, account_id, visible: true });
    if (!result.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: "Inspection created successfully", data: result });
  } catch (error) {
    next(error);
  }
};

 async updateById (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    const data = await inspectionService.updateInspection(id, req.body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    const result = await inspectionService.getAllInspection({ _id: new mongoose.Types.ObjectId(String(id)), account_id, visible: true });
    if (!result.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspection updated successfully", data: result });
  } catch (error) {
    next(error);
  }
};

 async removeById (req: Request, res: Response, next: NextFunction) {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    const data = await inspectionService.getAllInspection({ _id: id, account_id, visible: true });
    if (!data.length) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    const result = await inspectionService.removeInspection(id, account_id, user_id);
    if (!result) {
      throw Object.assign(new Error('Inspection not found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Inspection deleted successfully" });
  } catch (error) {
    next(error);
  }
};
}

export const inspectionController = new InspectionController();