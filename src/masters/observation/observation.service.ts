import { Observation, IObservation } from "../../models/observation.model";
import { Request, Response, NextFunction } from 'express';
import { getData } from "../../util/queryBuilder";
import { get } from "lodash";
import { IUser } from "../../models/user.model";
import mongoose from "mongoose";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { accountId: account_id };
    if (userRole !== 'admin') {
      match['user.id'] = user_id;
    }
    const params: any = req.query;
    if(params?.locationId) {
      match['locationId'] = new mongoose.Types.ObjectId(params.locationId);
    }
    if(params?.top_level_asset_id) {
      match['top_level_asset_id'] = new mongoose.Types.ObjectId(params.top_level_asset_id);
    }
    if(params?.assetId) {
      match['assetId'] = new mongoose.Types.ObjectId(params.assetId);
    }
    const data: IObservation[] = await getData(Observation, { filter: match });
    if (!data ||data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match = { accountId: account_id, _id: id };
    const data: IObservation[] | null = await getData(Observation, { filter: match });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newObservation = new Observation(req.body);
    const data = await newObservation.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Observation.findByIdAndUpdate(id, req.body, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Observation.findById(id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Observation.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};