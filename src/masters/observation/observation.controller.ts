import { Request, Response, NextFunction } from 'express';
import { getAllObservation, insertObservation, updateObservationById, removeObservationById } from './observation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

export const getObservations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    if (userRole !== 'admin') {
      match['userId'] = user_id;
    }
    const { query: { locationId, top_level_asset_id, assetId }} = req;
    if (locationId) {
      match['locationId'] = new mongoose.Types.ObjectId(`${locationId}`);
    }
    if (top_level_asset_id) {
      match['top_level_asset_id'] = new mongoose.Types.ObjectId(`${top_level_asset_id}`);
    }
    if (assetId) {
      match['assetId'] = new mongoose.Types.ObjectId(`${assetId}`);
    }
    const data = await getAllObservation(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
   try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id }, query: { locationId, top_level_asset_id, assetId }} = req;
    if (!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(`${id}`), account_id, visible: true };
    if (userRole !== 'admin') {
      match['userId'] = user_id;
    }
    if (locationId) {
      match['locationId'] = new mongoose.Types.ObjectId(`${locationId}`);
    }
    if (top_level_asset_id) {
      match['top_level_asset_id'] = new mongoose.Types.ObjectId(`${top_level_asset_id}`);
    }
    if (assetId) {
      match['assetId'] = new mongoose.Types.ObjectId(`${assetId}`);
    }
    const data = await getAllObservation(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const createObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    const data = await insertObservation(body, account_id, user_id);
    if(!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const updateObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const existingData = await getAllObservation({ _id: id, account_id, visible: true });
    if (!existingData || existingData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updateObservationById(id, body, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }    
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const removeObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const existingData = await getAllObservation({ _id: id, account_id, visible: true });
    if (!existingData || existingData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await removeObservationById(id, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }    
    res.status(200).json({ status: true, message: "Data updated successfully" });
  } catch (error) {
    next(error);
  }
}