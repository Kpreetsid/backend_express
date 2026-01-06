import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { assetService } from './asset.service';
import { IUser } from '../../models/user.model';
import { mapUserToAssetService, mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { locationService } from '../location/location.service';
import mongoose from 'mongoose';
import { processorAPIService } from '../../api-processor';
import { applyRoleFilter } from '../../util/roleFilter';

class AssetController {
  async getAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const baseFilter: any = {};
      const { query: { top_level_asset_id, top_level, locationId, parent_id } }: any = req;
      if (top_level_asset_id && top_level_asset_id.split(',').length > 0) {
        baseFilter.top_level_asset_id = { $in: top_level_asset_id.split(',') };
      }
      if (parent_id && parent_id.split(',').length > 0) {
        baseFilter._id = { $in: parent_id.split(',') };
        baseFilter.parent_id = { $in: parent_id.split(',') };
      }
      if (top_level) {
        baseFilter.top_level = top_level == 'true' ? true : false;
      }
      if (locationId) {
        const childIds = await locationService.getAllChildLocationIds(locationId);
        if(user.user_role !== 'admin') {
          const mappedData = await mapUserToLocationService.getDataByLocationIds([locationId, ...childIds]);
          baseFilter.locationId = { $in: mappedData.map(doc => doc.locationId) };
        } else {
          baseFilter.locationId = { $in: [locationId, ...childIds] };
        }
      }
      const filter: any = await applyRoleFilter({ user, baseFilter, accountField: "account_id", mapping: "asset" });
      let data = await assetService.getAllAssets(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getAsset(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id }, query: { top_level_asset_id, top_level, locationId } } = req;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const baseFilter: any = { _id: new mongoose.Types.ObjectId(id) };
      if (top_level_asset_id) {
        baseFilter.top_level_asset_id = top_level_asset_id.toString().split(',');
      }
      if (top_level) {
        baseFilter.top_level = top_level == 'true' ? true : false;
      }
      if (locationId) {
        baseFilter.locationId = new mongoose.Types.ObjectId(`${locationId}`);
      }
      const filter = await applyRoleFilter({ user, baseFilter, accountField: 'account_id', mapping: 'asset' });
      const data = await assetService.getAllAssets(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getBuzzerAssetList(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const baseFilter: any = {};
      const { location_id } = req.query;
      if (location_id) {
        baseFilter.locationId = new mongoose.Types.ObjectId(`${location_id}`);
      }
      const filter = await applyRoleFilter({ user, baseFilter, accountField: 'account_id', mapping: 'asset' });
      const data = await assetService.buzzerAssetList(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async setBuzzerAssetList(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const { params: { location_id }, body } = req;
      const baseFilter: any = {};
      if (location_id) {
        baseFilter.locationId = new mongoose.Types.ObjectId(location_id);
      }
      const filter = await applyRoleFilter({ user, baseFilter, accountField: 'account_id', mapping: 'asset' });
      const data = await assetService.buzzerAssetList(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      if (data.length !== body.length) {
        throw Object.assign(new Error('Bad Request'), { status: 400 });
      }
      await assetService.updateBuzzerAssetList(body);
      res.status(200).json({ status: true, message: "Data fetched successfully" });
    } catch (error) {
      next(error);
    }
  }

  async getChildAsset(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const childIds = await assetService.getAllChildAssetIDs(new mongoose.Types.ObjectId(`${id}`));
      if (childIds.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const filter = await applyRoleFilter({ user, baseFilter: { _id: { $in: childIds } }, accountField: 'account_id', mapping: 'asset' });
      const data = await assetService.getAllAssets(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getAssetTree(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const { id, location_id } = req.query;
      const baseFilter: any = {};
      if (id) {
        const ids = id.toString().split(',').map(x => new mongoose.Types.ObjectId(x));
        baseFilter.$or = [{ _id: { $in: ids } }, { parent_id: { $in: ids } }];
      }
      if (location_id) {
        baseFilter.locationId = { $in: location_id.toString().split(',').map(x => new mongoose.Types.ObjectId(x)) };
      }
      const filter = await applyRoleFilter({ user, baseFilter, accountField: 'account_id', mapping: 'asset' });
      const data = await assetService.getAssetsTreeData(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getFilteredAssets(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { locationList = [], assets = [], top_level } = req.body;
      const match: any = { account_id, visible: true };
      if (userRole !== "admin") {
        const mapData = await mapUserToAssetService.getAssetsMappedData(user_id);
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
        if (userRole !== "admin") {
          const mapData = await mapUserToAssetService.getAssetsMappedData(user_id);
          match._id = { $in: mapData.map(doc => doc.assetId) };
        }
      }
      if (assets && assets.length > 0) {
        match._id = { $in: assets };
      }
      const data = await assetService.getAllAssets(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async createOld(req: Request, res: Response, next: NextFunction): Promise<any> {
    var data: any;
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { body } = req;
      if (body.userIdList?.length === 0) {
        throw Object.assign(new Error('Please select at least one user'), { status: 400 });
      }
      data = await assetService.createAssetOld(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const assetsMapData = body.userIdList.map((user: any) => ({ account_id, userId: user, assetId: data._id }));
      await mapUserToAssetService.createMapUserAssets(assetsMapData);
      await processorAPIService.setAssetHealthStatus(assetsMapData, account_id, user_id, userToken);
      const insertedData: any = await assetService.getAllAssets({ _id: data._id });
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Data created successfully", data: insertedData });
    } catch (error) {
      if (data) {
        await assetService.deleteAssetsById(data._id);
      }
      next(error);
    }
  }

  async updateOld(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      if (body.userIdList?.length === 0) {
        throw Object.assign(new Error('Please select at least one user'), { status: 400 });
      }
      const existingData: any = await assetService.getAllAssets({ _id: id, account_id: account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      if (body.locationId !== existingData[0].locationId) {
        await assetService.updateAllChildAssetsLocation(id, body.locationId, user_id);
      }
      const data = await assetService.updateAssetOld(id, body, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const insertedData: any = await assetService.getAllAssets({ _id: id });
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data created successfully", data: insertedData });
    } catch (error) {
      next(error);
    }
  }

  async updateAssetImage(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      if (!req.params.id) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const { image_path } = req.body;
      if (!image_path) {
        throw Object.assign(new Error('Image path is required'), { status: 400 });
      }
      const dataExists: any = await assetService.getAllAssets({ _id: req.params.id, account_id: account_id, visible: true });
      if (!dataExists || dataExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      await assetService.updateAssetImageById(req.params.id, image_path, `${user_id}`);
      res.status(200).json({ status: true, message: "Data updated successfully" });
    } catch (error) {
      next(error);
    }
  }

  async removeAsset(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      if (!req.params.id) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const match: any = { _id: req.params.id, account_id: account_id, visible: true };
      const dataExists: any = await assetService.getAllAssets(match);
      if (!dataExists || dataExists.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      await mapUserToLocationService.removeLocationMapping(req.params.id);
      await assetService.removeById(match, user_id);
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  async getAssetSensorList(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      let { assetList } = req.query;
      if (assetList && assetList.toString().split(',').length > 0) {
        match._id = { $in: assetList.toString().split(',').map((x: any) => new mongoose.Types.ObjectId(`${x}`)) };
      }
      if (userRole !== 'admin') {
        const mapData = await mapUserToAssetService.getAssetsMappedData(user_id);
        if (mapData && mapData.length > 0) {
          match._id = { $in: mapData.map((doc: any) => doc.assetId) };
        }
      }
      const data = await assetService.getAssetDataSensorList(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getFilteredAssetSensorList(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      let { assetList } = req.body;
      if (assetList && assetList.length > 0) {
        match._id = { $in: assetList.map((x: any) => new mongoose.Types.ObjectId(`${x}`)) };
      }
      if (userRole !== 'admin') {
        const mapData = await mapUserToAssetService.getAssetsMappedData(user_id);
        if (mapData && mapData.length > 0) {
          match._id = { $in: mapData.map((doc: any) => doc.assetId) };
        }
      }
      const data = await assetService.getAssetDataSensorList(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async makeAssetCopy(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { params: { id } } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw Object.assign(new Error("No asset id provided"), { status: 400 });
      }
      const dataExists: any = await assetService.getAllAssets({ _id: id, account_id, visible: true });
      if (!dataExists || dataExists.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      const sourceAsset = dataExists[0];
      const allChildren: any[] = await assetService.getAllChildAssetsRecursive(id, account_id);
      const idMap: Record<string, any> = {};
      const originalTopLevelId = sourceAsset.top_level ? sourceAsset.id : sourceAsset.top_level_asset_id;
      const parentForCopy = sourceAsset.parent_id ? sourceAsset.parent_id.id : undefined;
      const newParentId = await assetService.makeAssetCopyByIdWithChildren(sourceAsset, user_id, userToken, account_id, parentForCopy, idMap, null);
      const newTopLevelId = sourceAsset.top_level ? newParentId : originalTopLevelId;
      idMap[`${sourceAsset.id}`] = newParentId;
      for (const child of allChildren) {
        const newParent = idMap[child.parent_id?.toString()] || newParentId;
        const newChildId = await assetService.makeAssetCopyByIdWithChildren(child, user_id, userToken, account_id, newParent, idMap, newTopLevelId);
        idMap[child._id.toString()] = newChildId;
      }
      await processorAPIService.setAssetHealthStatus([{ assetId: newParentId }, ...allChildren.map(c => ({ assetId: idMap[c._id.toString()] }))], account_id, user_id, userToken);
      const copiedData: any = await assetService.getAllAssets({ _id: newParentId, account_id, visible: true });
      res.status(201).json({ status: true, message: "Asset hierarchy copied successfully", data: copiedData });
    } catch (error) {
      next(error);
    }
  };
}

export const assetController = new AssetController();