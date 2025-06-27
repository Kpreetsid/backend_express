import express, { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getAll, insert, updateById, removeById, getAssetsTreeData, getAssetsFilteredData } from './asset.service';
import { IUser } from '../../models/user.model';
import { getAssetsMappedData } from '../../transaction/mapUserLocation/userLocation.service';
import mongoose from 'mongoose';
import { uploadBase64Image } from '../../_config/upload';

export const getAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, visible: true };
    const params: any = req.query;
    if (userRole !== 'admin') {
      const mappedData = await getAssetsMappedData(`${user_id}`);
      if (!mappedData || mappedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mappedData.map(doc => doc.assetId) };
    }
    if (params.top_level_asset_id && params.top_level_asset_id.split(',').length > 0) {
      match.top_level_asset_id = params.top_level_asset_id.split(',');
    }
    if (params.top_level) {
      match.top_level = params.top_level == 'true' ? true : false;
    }
    if (params.locationId) {
      match.locationId = new mongoose.Types.ObjectId(params.locationId);
    }
    let data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const params: any = req.query;
    const { id } = req.params;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: id, account_id: account_id, visible: true };
    if (userRole !== 'admin') {
      const mappedData = await getAssetsMappedData(`${user_id}`);
      if (!mappedData || mappedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mappedData.map(doc => doc.assetId) };
    }
    if (params.top_level_asset_id && params.top_level_asset_id.split(',').length > 0) {
      match.top_level_asset_id = params.top_level_asset_id.split(',');
    }
    if (params.top_level) {
      match.top_level = params.top_level == 'true' ? true : false;
    }
    if (params.locationId) {
      match.locationId = new mongoose.Types.ObjectId(params.locationId);
    }
    const data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getAssetTree = async (req: Request, res: Response, next: NextFunction) => {
  await getAssetsTreeData(req, res, next);
}

export const getFilteredAssets = async (req: Request, res: Response, next: NextFunction) => {
  await getAssetsFilteredData(req, res, next);
}

export const createAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fans_Blowers, Pumps, Compressor } = req.body;
    const childAssets: any[] = [];
    if (!Equipment.userList || Equipment.userList.length === 0) {
      throw Object.assign(new Error('Please select at least one user'), { status: 400 });
    }
    if (Equipment.image_path) {
      const image = await uploadBase64Image(Equipment.image_path, "assets");
      Equipment.image_path = image.fileName;
    }
    
    await insert(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const updateAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const { Equipment, Motor, Flexible, Rigid, Belt_Pulley, Gearbox, Fans_Blowers, Pumps, Compressor } = req.body;
    if (req.params.id !== Equipment.id) {
      throw Object.assign(new Error('Data mismatch'), { status: 403 });
    }
    const dataExists: any = await getAll({ _id: req.params.id, account_id: account_id, visible: true });
    if (!dataExists || dataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await updateById(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const removeAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: id, account_id: account_id, visible: true };
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    await removeById(match);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
}