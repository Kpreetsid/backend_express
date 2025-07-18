import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getAll, insert, updateById, removeById, getAssetsTreeData, getAssetsFilteredData, updateAssetImageById, getAssetDataSensorList } from './asset.service';
import { IUser } from '../../models/user.model';
import { getAssetsMappedData, removeLocationMapping } from '../../transaction/mapUserLocation/userLocation.service';
import mongoose from 'mongoose';
import { uploadBase64Image } from '../../_config/upload';

export const getAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
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
    next(error);
  }
}

export const getAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const params: any = req.query;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, visible: true };
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
    next(error);
  }
}

export const getAssetTree = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAssetsTreeData(req, res, next);
}

export const getFilteredAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAssetsFilteredData(req, res, next);
}

export const createAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { Equipment } = req.body;
    if (!Equipment.userList || Equipment.userList.length === 0) {
      throw Object.assign(new Error('Please select at least one user'), { status: 400 });
    }
    if (Equipment.image_path) {
      const image = await uploadBase64Image(Equipment.image_path, "assets");
      Equipment.image_path = image.fileName;
    }
    await insert(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const updateAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const { Equipment } = req.body;
    if (req.params.id !== Equipment.id) {
      throw Object.assign(new Error('Data mismatch'), { status: 403 });
    }
    const dataExists: any = await getAll({ _id: req.params.id, account_id: account_id, visible: true });
    if (!dataExists || dataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await updateById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const updateAssetImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const { image_path } = req.body;
    if (!image_path) {
      throw Object.assign(new Error('Image path is required'), { status: 400 });
    }
    const dataExists: any = await getAll({ _id: req.params.id, account_id: account_id, visible: true });
    if (!dataExists || dataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await updateAssetImageById(req.params.id, image_path, `${user_id}`);
    res.status(200).json({ status: true, message: "Data updated successfully" });
  } catch (error) {
    next(error);
  }
}

export const removeAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, visible: true };
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const dataExists: any = await getAll(match);
    if (!dataExists || dataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await removeLocationMapping(req.params.id);
    await removeById(match, user_id);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}

export const getAssetSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAssetDataSensorList(req, res, next);
}