import { controllerCache } from '../../_cache/controllerCache.service';
import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { assetService } from './asset.service';
import { IUser, UserModel } from '../../models/user.model';
import { mapUserToAssetService } from '../../transaction/mapUserAsset/userAsset.service';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { locationService } from '../location/location.service';
import { helperService } from '../../utils/helper';
import { processorAPIService } from '../../api-processor';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from "../../utils/transaction.helper";

class AssetController {

  getAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const baseFilter: any = {};
      const {
        query: { top_level_asset_id, top_level, locationId, parent_id },
      }: any = req;
      if (helperService.hasValue(top_level_asset_id)) {
        baseFilter.top_level_asset_id = { $in: helperService.validateObjectIds(String(top_level_asset_id)) };
      }
      if (helperService.hasValue(parent_id)) {
        const validatedParentIds = helperService.validateObjectIds(String(parent_id));
        baseFilter._id = { $in: validatedParentIds };
        baseFilter.parent_id = { $in: validatedParentIds };
      }
      if (top_level) {
        baseFilter.top_level = top_level == "true" ? true : false;
      }
      if (helperService.hasValue(locationId)) {
        const validatedLocationIds = helperService.validateObjectIds(String(locationId));
        const rootLocationIds = validatedLocationIds.map((id) => String(id));
        const childLocationGroups = await Promise.all(rootLocationIds.map((id) => locationService.getAllChildLocationIds(id, user.account_id)));
        const expandedLocationIds = [...new Set([...rootLocationIds, ...childLocationGroups.flat()])];
        if (user.user_role !== "admin") {
          const mappedData = await mapUserToLocationService.getDataByLocationIds(expandedLocationIds);
          baseFilter.locationId = { $in: mappedData.map((doc) => doc.locationId) };
        } else {
          baseFilter.locationId = { $in: helperService.validateObjectIds(expandedLocationIds) };
        }
      }
      const filter: any = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "asset",
        idField: "_id",
      });
      let data = await assetService.getAllAssets(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("No assets found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Assets retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id }, query: { top_level_asset_id, top_level, locationId } } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)) };
      if (helperService.hasValue(top_level_asset_id)) {
        baseFilter.top_level_asset_id = helperService.validateObjectIds(String(top_level_asset_id));
      }
      if (top_level) {
        baseFilter.top_level = top_level == "true" ? true : false;
      }
      if (helperService.hasValue(locationId)) {
        baseFilter.locationId = helperService.validateObjectId(String(locationId));
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "asset",
        idField: "_id",
      });
      const data = await assetService.getAllAssets(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Asset retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getBuzzerAssetList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const baseFilter: any = {};
      const { location_id } = req.query;
      if (location_id) {
        baseFilter.locationId = helperService.validateObjectId(String(location_id));
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "asset",
        idField: "_id",
      });
      const data = await assetService.buzzerAssetList(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("No buzzer assets found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Buzzer assets retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  };

  setBuzzerAssetList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const {
        params: { location_id },
        body,
      } = req;
      const baseFilter: any = {};
      if (location_id) {
        baseFilter.locationId = helperService.validateObjectId(String(location_id));
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "asset",
        idField: "_id",
      });
      const data = await assetService.buzzerAssetList(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      if (data.length !== body.length) {
        throw Object.assign(new Error("Invalid asset list count"), { status: 400 });
      }
      await assetService.updateBuzzerAssetList(body);
      res.status(200).json({ status: true, message: "Buzzer asset list updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  getChildAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const childIds = await assetService.getAllChildAssetIDs(helperService.validateObjectId(String(id)), user.account_id);
      if (childIds.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter: { _id: { $in: childIds } },
        accountField: "account_id",
        mapping: "asset",
        idField: "_id",
      });
      const data = await assetService.getAllAssets(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("No child assets found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Child assets retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getAssetTree = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id, location_id } = req.query;
      const baseFilter: any = {};
      if (id) {
        baseFilter.$or = [{ _id: { $in: helperService.validateObjectIds(String(id)) } }, { parent_id: { $in: helperService.validateObjectIds(String(id)) } }];
      }
      if (location_id) {
        baseFilter.locationId = { $in: helperService.validateObjectIds(String(location_id)) };
      }
      const filter = await applyRoleFilter({ user, baseFilter, accountField: "account_id", mapping: "asset", idField: "_id" });
      const data = await assetService.getAssetsTreeData(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Asset tree fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getFilteredAssets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { locationList = [], assets = [], top_level } = req.body;
      if (!Array.isArray(locationList) || !Array.isArray(assets)) {
        throw Object.assign(new Error('Asset filters must be arrays'), { status: 400 });
      }
      const baseFilter: any = {};
      if (top_level !== undefined) {
        if (typeof top_level !== 'boolean') throw Object.assign(new Error('top_level must be a boolean'), { status: 400 });
        baseFilter.top_level = top_level;
      }
      if (locationList.length > 0) {
        baseFilter.locationId = { $in: helperService.validateObjectIds(locationList, 5000) };
      }
      if (assets.length > 0) {
        baseFilter._id = { $in: helperService.validateObjectIds(assets, 5000) };
      }
      const match = await this.buildMappedAssetFilter(user, baseFilter);
      const data = await assetService.getAllAssets(match);
      res.status(200).json({ status: true, message: "Filtered assets retrieved successfully", data: data || [] });
    } catch (error) {
      next(error);
    }
  };

  private buildMappedAssetFilter = async (user: IUser, baseFilter: Record<string, any>): Promise<Record<string, any>> => {
    const match: Record<string, any> = { ...baseFilter, account_id: user.account_id, visible: true };
    if (user.user_role === 'admin') return match;

    const mappedData = await mapUserToAssetService.getAssetsMappedData(user._id);
    const mappedAssetIds = (mappedData || []).map((doc: any) => doc.assetId).filter(Boolean);
    const requestedScope = match._id;
    if (requestedScope) {
      match.$and = [
        ...(Array.isArray(match.$and) ? match.$and : []),
        { _id: requestedScope },
        { _id: { $in: mappedAssetIds } }
      ];
      delete match._id;
    } else {
      match._id = { $in: mappedAssetIds };
    }
    return match;
  };

  createOld = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    var data: any;
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const body = { ...(req.body || {}) };
      body.userIdList = await this.assertAccountUsers(body.userIdList, account_id);
      body.alarmType = this.normalizeAlarmTypes(body.alarmType);
      delete body.account_id;
      delete body.createdBy;
      delete body.updatedBy;
      delete body.visible;

      const location = await locationService.getLocationById(
        helperService.validateObjectId(String(body.locationId)),
        account_id
      );
      if (!location) {
        throw Object.assign(new Error('Location not found'), { status: 400 });
      }
      body.locationId = location._id;

      if (body.parent_id) {
        const parent = await assetService.getAssetHierarchyNode(
          helperService.validateObjectId(String(body.parent_id)),
          account_id
        );
        if (!parent) {
          throw Object.assign(new Error('Parent asset not found'), { status: 400 });
        }
        if (String(parent.locationId) !== String(location._id)) {
          throw Object.assign(new Error('Parent asset and location must match'), { status: 400 });
        }
        body.parent_id = parent._id;
        body.top_level = false;
        body.top_level_asset_id = parent.top_level
          ? parent._id
          : (parent.top_level_asset_id || parent._id);
      } else {
        body.top_level = true;
        delete body.parent_id;
        delete body.top_level_asset_id;
      }
      data = await assetService.createAssetOld(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      const assetsMapData = body.userIdList.map((user: any) => {
        return {
          account_id,
          userId: user,
          assetId: data._id,
          sendMail: body.alarmType.includes("sendMail"),
          alert: body.alarmType.includes("alert"),
          danger: body.alarmType.includes("danger"),
          critical: body.alarmType.includes("critical"),
        };
      });
      await mapUserToAssetService.createMapUserAssets(assetsMapData);
      await processorAPIService.setAssetHealthStatus(
        assetsMapData,
        account_id,
        user_id,
        userToken,
      );
      const insertedData: any = await assetService.getAllAssets({ _id: data._id, account_id, visible: true });
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Asset',
        event: 'created',
        entityId: String(data._id),
        entityName: insertedData[0]?.asset_name || body.asset_name || 'Asset',
        actionUrl: `/assets/asset-health/${data._id}/health`,
        sourceUserId: String(user_id)
      });
      res.status(201).json({ status: true, message: "Asset created successfully", data: insertedData });
    } catch (error) {
      if (data) {
        await assetService.deleteAssetsById(data._id);
      }
      next(error);
    }
  };

  updateOld = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const body = { ...(req.body || {}) };
      body.userIdList = await this.assertAccountUsers(body.userIdList, account_id);
      delete body.account_id;
      delete body.createdBy;
      delete body.updatedBy;
      delete body.visible;
      delete body.top_level;
      delete body.parent_id;
      delete body.top_level_asset_id;
      const existingData: any = await assetService.getAllAssets({ _id: helperService.validateObjectId(String(id)), account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      body.alarmType = this.normalizeAlarmTypes(body.alarmType ?? existingData[0].alarmType);
      const hierarchy = await assetService.getAssetHierarchyNode(helperService.validateObjectId(String(id)), account_id);
      const targetLocation = await locationService.getLocationById(
        helperService.validateObjectId(String(body.locationId)),
        account_id
      );
      if (!hierarchy || !targetLocation) {
        throw Object.assign(new Error('Asset location not found'), { status: 400 });
      }
      body.locationId = targetLocation._id;
      if (hierarchy.parent_id) {
        const parent = await assetService.getAssetHierarchyNode(hierarchy.parent_id, account_id);
        if (!parent || String(parent.locationId) !== String(targetLocation._id)) {
          throw Object.assign(new Error('Child asset must remain in its parent asset location'), { status: 400 });
        }
      }

      const existingLocationId = existingData[0].locationId?.id
        || existingData[0].locationId?._id
        || existingData[0].locationId;
      if (String(body.locationId) !== String(existingLocationId)) {
        await assetService.updateAllChildAssetsLocation(
          helperService.validateObjectId(String(id)), body.locationId, user_id, account_id);
      }
      const data = await assetService.updateAssetOld(helperService.validateObjectId(String(id)), body, user_id, account_id);
      if (!data) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      const insertedData: any = await assetService.getAllAssets({
        _id: helperService.validateObjectId(String(id)),
        account_id,
        visible: true,
      });
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'Asset',
        event: 'updated',
        entityId: String(id),
        entityName: insertedData[0]?.asset_name || body.asset_name || 'Asset',
        actionUrl: `/assets/asset-health/${id}/health`,
        sourceUserId: String(user_id)
      });
      res.status(200).json({ status: true, message: "Asset updated successfully", data: insertedData });
    } catch (error) {
      next(error);
    }
  };

  updateAssetImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const {
        params: { id },
      } = req;
      const { image_path } = req.body;
      if (!image_path) {
        throw Object.assign(new Error("Image path is required"), {
          status: 400,
        });
      }
      const dataExists: any = await assetService.getAllAssets({
        _id: helperService.validateObjectId(String(id)),
        account_id,
        visible: true,
      });
      if (!dataExists || dataExists.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      await assetService.updateAssetImageById(
        helperService.validateObjectId(String(id)),
        image_path,
        user_id,
      );
      res
        .status(200)
        .json({ status: true, message: "Asset image updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  removeAsset = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const {
        params: { id },
      } = req;
      const match: any = {
        _id: helperService.validateObjectId(String(id)),
        account_id,
        visible: true,
      };
      const dataExists: any = await assetService.getAllAssets(match);
      if (!dataExists || dataExists.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      await mapUserToLocationService.removeLocationMapping(
        helperService.validateObjectId(String(id)),
      );
      await assetService.removeById(match, user_id);
      res
        .status(200)
        .json({ status: true, message: "Asset deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  getAssetSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { assetList } = req.query;
      const baseFilter: any = {};
      if (assetList) baseFilter._id = { $in: helperService.validateObjectIds(String(assetList), 5000) };
      const match = await this.buildMappedAssetFilter(user, baseFilter);
      const data = await assetService.getAssetDataSensorList(match);
      res
        .status(200)
        .json({ status: true, message: "Asset sensor list fetched successfully", data: data || [] });
    } catch (error) {
      next(error);
    }
  };

  getFilteredAssetSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const user = get(req, "user", {}) as IUser;
      const { assetList = [] } = req.body || {};
      if (!Array.isArray(assetList)) throw Object.assign(new Error('assetList must be an array'), { status: 400 });
      const baseFilter: any = {};
      if (assetList.length > 0) baseFilter._id = { $in: helperService.validateObjectIds(assetList, 5000) };
      const match = await this.buildMappedAssetFilter(user, baseFilter);
      const data = await assetService.getAssetDataSensorList(match);
      res
        .status(200)
        .json({ status: true, message: "Asset sensor list fetched successfully", data: data || [] });
    } catch (error) {
      next(error);
    }
  };

  makeAssetCopy = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", "") as string;
      const { params: { id } } = req;

      const source = await assetService.getAssetHierarchyNode(
        helperService.validateObjectId(String(id)),
        account_id
      );
      if (!source) {
        throw Object.assign(new Error('Asset not found'), { status: 404 });
      }
      this.assertRolePermission(req, 'asset', source.top_level || !source.parent_id
        ? 'add_asset'
        : 'add_child_asset');

      const result = await withTransaction(async (session: any) => {
        const newParentId = await assetService.makeAssetCopyRecursive(String(id), user_id, userToken, account_id, undefined, session);
        if (!newParentId) {
          throw Object.assign(new Error("Asset not found"), { status: 404 });
        }
        const copiedData: any = await assetService.getAllAssets({
          _id: newParentId,
          account_id,
          visible: true,
        });
        return copiedData;
      });

      res.status(201).json({
        status: true,
        message: "Asset hierarchy copied successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  private assertRolePermission(req: Request, moduleName: string, action: string): void {
    const roleMenu: any = get(req, 'role', {});
    if (roleMenu?.[moduleName]?.[action] !== true) {
      throw Object.assign(new Error('You do not have permission to access.'), { status: 403 });
    }
  }

  private async assertAccountUsers(userIdList: unknown, accountId: any): Promise<string[]> {
    if (!Array.isArray(userIdList) || userIdList.length === 0) {
      throw Object.assign(new Error('Please select at least one user'), { status: 400 });
    }
    const uniqueIds = Array.from(new Set(userIdList.map(String).map(id => id.trim()).filter(Boolean)));
    const objectIds = helperService.validateObjectIds(uniqueIds, 500);
    const count = await UserModel.countDocuments({ _id: { $in: objectIds }, account_id: accountId });
    if (count !== objectIds.length) {
      throw Object.assign(new Error('Every selected user must belong to the active account'), { status: 400 });
    }
    return objectIds.map(id => String(id));
  }

  private normalizeAlarmTypes(value: unknown): string[] {
    const allowed = new Set(['alert', 'danger', 'critical', 'sendMail']);
    const normalized = Array.isArray(value)
      ? Array.from(new Set(value.map(String).map(item => item.trim()).filter(item => allowed.has(item))))
      : [];
    return normalized.length ? normalized : ['alert', 'danger', 'critical'];
  }
}

export const assetController = controllerCache.withCache(new AssetController(), { namespace: 'assets', ttlSeconds: 300, tags: ['assets', 'locations', 'work'] });
