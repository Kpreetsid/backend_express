import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { getAllAssets, removeById, getAssetsTreeData, createAssetOld, updateAssetOld, updateAssetImageById, getAssetDataSensorList, createExternalAPICall, deleteAssetsById, updateAllChildAssetsLocation, getAllChildAssetIDs, getAllChildAssetsRecursive, makeAssetCopyByIdWithChildren, buzzerAssetList, updateBuzzerAssetList } from './asset.service';
import { IUser } from '../../models/user.model';
import { createMapUserAssets, getAssetsMappedData, getDataByLocationIds, removeLocationMapping, updateMapUserAssets } from '../../transaction/mapUserLocation/userLocation.service';
import { getAllChildLocationIds } from '../location/location.service';
import mongoose from 'mongoose';

export const getAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    const { query: { top_level_asset_id, top_level, locationId, parent_id } }: any = req;
    if (userRole !== 'admin') {
      const mappedData = await getAssetsMappedData(`${user_id}`);
      if (!mappedData || mappedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mappedData.map(doc => doc.assetId) };
    }
    if (top_level_asset_id && top_level_asset_id.split(',').length > 0) {
      match.top_level_asset_id = { $in: top_level_asset_id.split(',') };
    }
    if (parent_id && parent_id.split(',').length > 0) {
      match._id = { $in: parent_id.split(',') };
      match.parent_id = { $in: parent_id.split(',') };
    }
    if (top_level) {
      match.top_level = top_level == 'true' ? true : false;
    }
    if (locationId) {
      const childIds = await getAllChildLocationIds(locationId);
      const mappedData = await getDataByLocationIds([locationId, ...childIds]);
      match.locationId = { $in: mappedData.map(doc => doc.locationId) };
    }
    let data = await getAllAssets(match);
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
    const { account_id } = get(req, "user", {}) as IUser;
    const { params: { id }, query: { top_level_asset_id, top_level, locationId } } = req;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(`${id}`), account_id: account_id, visible: true };
    if (top_level_asset_id) {
      match.top_level_asset_id = top_level_asset_id.toString().split(',');
    }
    if (top_level) {
      match.top_level = top_level == 'true' ? true : false;
    }
    if (locationId) {
      match.locationId = new mongoose.Types.ObjectId(`${locationId}`);
    }
    const data = await getAllAssets(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getBuzzerAssetList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, visible: true };
    const { query: { location_id } } = req;
    if(location_id) {
      match.locationId = new mongoose.Types.ObjectId(`${location_id}`);
    }
    const data = await buzzerAssetList(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const setBuzzerAssetList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true }
    const { params: { location_id }, body } = req;
    if(location_id) {
      match.locationId = new mongoose.Types.ObjectId(`${location_id}`);
    }
    const data = await buzzerAssetList(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if (data.length !== body.length) {    
      throw Object.assign(new Error('Bad Request'), { status: 400 });
    }
    await updateBuzzerAssetList(body);
    res.status(200).json({ status: true, message: "Data fetched successfully" });
  } catch (error) {
    next(error);
  }
}

export const getChildAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const childIds = await getAllChildAssetIDs(new mongoose.Types.ObjectId(`${id}`));
    if (childIds.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: { $in: childIds }, account_id: account_id, visible: true };
    const data = await getAllAssets(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getAssetTree = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    let { location_id, id } = req.query;
    let assetQuery: any = { account_id, visible: true };
    if (userRole !== "admin") {
      const mapData = await getAssetsMappedData(user_id);
      assetQuery._id = mapData.map(doc => doc?.assetId ? new mongoose.Types.ObjectId(`${doc?.assetId}`) : null).filter((x) => x);
    }
    if (id) {
      assetQuery._id = { $in: id.toString().split(',').map((x: any) => new mongoose.Types.ObjectId(`${x}`)) };
    }
    if (location_id) {
      assetQuery.locationId = { $in: location_id.toString().split(',').map((x: any) => new mongoose.Types.ObjectId(`${x}`)) };
    }
    const data = await getAssetsTreeData(assetQuery);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getFilteredAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { locationList = [], assets = [], top_level } = req.body;
    const match: any = { account_id, visible: true };
    if(userRole !== "admin") {
      const mapData = await getAssetsMappedData(user_id);
      if (!mapData || mapData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mapData.map(doc => doc.assetId) };
    }
    if (top_level) {
      match.top_level = top_level;
    }
    if (locationList && locationList.length > 0) {
      match.locationId = { $in: locationList };
      if(userRole !== "admin") {
        const mapData = await getAssetsMappedData(user_id);
        match._id = { $in: mapData.map(doc => doc.assetId) };
      }
    }
    if (assets && assets.length > 0) {
      match._id = { $in: assets };
    }
    const data = await getAllAssets(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const createOld = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  var data: any;
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const userToken = get(req, "userToken", {}) as string;
    const { body } = req;
    if(body.userIdList?.length === 0) {
      throw Object.assign(new Error('Please select at least one user'), { status: 400 });
    }
    data = await createAssetOld(body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const assetsMapData = body.userIdList.map((user: any) => ({ account_id, userId: user, assetId: data._id }));
    await createMapUserAssets(assetsMapData);
    await createExternalAPICall(assetsMapData, account_id, user_id, userToken);
    const insertedData: any = await getAllAssets({ _id: data._id });
    if (!insertedData || insertedData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: "Data created successfully", data: insertedData });
  } catch (error) {
    if (data) {
      await deleteAssetsById(data._id);
    }
    next(error);
  }
}

export const updateOld = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    if(body.userIdList?.length === 0) {
      throw Object.assign(new Error('Please select at least one user'), { status: 400 });
    }
    const existingData: any = await getAllAssets({ _id: id, account_id: account_id, visible: true });
    if (!existingData || existingData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    console.log(existingData[0].locationId, body.locationId);
    if(body.locationId !== existingData[0].locationId) {
      await updateAllChildAssetsLocation(id, body.locationId, user_id);
    }
    const data = await updateAssetOld(id, body, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await updateMapUserAssets(id, body.userIdList);
    const insertedData: any = await getAllAssets({ _id: id });
    if (!insertedData || insertedData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data created successfully", data: insertedData });
  } catch (error) {
    next(error);
  }
}

export const updateAssetImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const { image_path } = req.body;
    if (!image_path) {
      throw Object.assign(new Error('Image path is required'), { status: 400 });
    }
    const dataExists: any = await getAllAssets({ _id: req.params.id, account_id: account_id, visible: true });
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
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, visible: true };
    const dataExists: any = await getAllAssets(match);
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

export const makeAssetCopy = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const userToken = get(req, "userToken", {}) as string;
    const { params: { id } } = req;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw Object.assign(new Error("No asset id provided"), { status: 400 });
    }
    const dataExists: any = await getAllAssets({ _id: id, account_id, visible: true });
    if (!dataExists || dataExists.length === 0) {
      throw Object.assign(new Error("Asset not found"), { status: 404 });
    }
    const sourceAsset = dataExists[0];
    const allChildren: any[] = await getAllChildAssetsRecursive(id, account_id);
    const idMap: Record<string, any> = {};
    const originalTopLevelId = sourceAsset.top_level ? sourceAsset.id : sourceAsset.top_level_asset_id;
    const parentForCopy = sourceAsset.parent_id ? sourceAsset.parent_id.id : undefined;
    const newParentId = await makeAssetCopyByIdWithChildren(sourceAsset, user_id, userToken, account_id, parentForCopy, idMap, null );
    const newTopLevelId = sourceAsset.top_level ? newParentId : originalTopLevelId;
    idMap[`${sourceAsset.id}`] = newParentId;
    for (const child of allChildren) {
      const newParent = idMap[child.parent_id?.toString()] || newParentId;
      const newChildId = await makeAssetCopyByIdWithChildren(child, user_id, userToken, account_id, newParent, idMap, newTopLevelId );
      idMap[child._id.toString()] = newChildId;
    }
    await createExternalAPICall([{ assetId: newParentId }, ...allChildren.map(c => ({ assetId: idMap[c._id.toString()] }))], account_id, user_id, userToken);
    const copiedData: any = await getAllAssets({ _id: newParentId, account_id, visible: true });
    res.status(201).json({ status: true, message: "Asset hierarchy copied successfully", data: copiedData});
  } catch (error) {
    next(error);
  }
};