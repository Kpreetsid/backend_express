import { ObservationModel, IObservation } from "../../models/observation.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../../models/user.model";
import mongoose from "mongoose";

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    // const match: any = { accountId: account_id };
    const match: any = userRole === "super_admin" ? {} : { _id: account_id, visible: true };

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      match['user.id'] = user_id;
    }
    const params: any = req.query;
    if (params?.locationId) {
      match['locationId'] = new mongoose.Types.ObjectId(params.locationId);
    }
    if (params?.top_level_asset_id) {
      match['top_level_asset_id'] = new mongoose.Types.ObjectId(params.top_level_asset_id);
    }
    if (params?.assetId) {
      match['assetId'] = new mongoose.Types.ObjectId(params.assetId);
    }
    const data: IObservation[] | null = await ObservationModel.find(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    // const match = { accountId: account_id, _id: req.params.id };
    const match: any = userRole === "super_admin" ? {} : { _id: account_id, visible: true };
    const data: IObservation[] | null = await ObservationModel.find(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const newObservation = new ObservationModel(req.body);
    const data = await newObservation.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await ObservationModel.findByIdAndUpdate(id, body, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await ObservationModel.findById(req.params.id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await ObservationModel.findByIdAndUpdate(req.params.id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};