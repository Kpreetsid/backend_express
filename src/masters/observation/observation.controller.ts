import { Request, Response, NextFunction } from 'express';
import { getAllObservation, insertObservation, updateObservationById, removeObservationById, setAssetHealthStatus, deleteObservationById } from './observation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';
import { getAllChildAssetIDs } from '../asset/asset.service';

export const getObservations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { accountId: account_id };
    const { query: { locationId, assetId, alarmId }} = req;
    if (locationId) {
      match['locationId'] = new mongoose.Types.ObjectId(`${locationId}`);
    }
    if (assetId) {
      const childAssetIds = await getAllChildAssetIDs(new mongoose.Types.ObjectId(`${assetId}`));
      match['assetId'] = { $in: childAssetIds };
    }
    if (alarmId) {
      match['alarmId'] = Number(alarmId);
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
    const { params: { id }} = req;
    if (!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(`${id}`), accountId: account_id };
    if (userRole !== 'admin') {
      match['userId'] = user_id;
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
  var data: any;
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const userToken = get(req, "userToken", {}) as string;
    const { body } = req;
    data = await insertObservation(body, account_id, user_id);
    if(!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: data._id };
    const insertedData = await getAllObservation(match);
    if (!insertedData || insertedData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await setAssetHealthStatus(body, account_id, user_id, userToken);
    res.status(201).json({ status: true, message: "Data created successfully", data: insertedData });
  } catch (error) {
    if (data) {
      await deleteObservationById(data._id);
    }
    next(error);
  }
}

export const updateObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const existingData = await getAllObservation({ _id: new mongoose.Types.ObjectId(`${id}`), accountId: account_id });
    if (!existingData || existingData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updateObservationById(id, body, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(`${id}`) };
    const insertedData = await getAllObservation(match);
    if (!insertedData || insertedData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data : insertedData });
  } catch (error) {
    next(error);
  }
}

export const removeObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const existingData = await getAllObservation({ _id: new mongoose.Types.ObjectId(`${id}`), accountId: account_id });
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