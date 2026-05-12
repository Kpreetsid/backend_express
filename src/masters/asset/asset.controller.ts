import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { assetService } from './asset.service';
import { IUser } from '../../models/user.model';
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
      if (top_level_asset_id) {
        baseFilter.top_level_asset_id = { $in: helperService.validateObjectIds(String(top_level_asset_id)) };
      }
      if (parent_id) {
        const validatedParentIds = helperService.validateObjectIds(String(parent_id));
        baseFilter._id = { $in: validatedParentIds };
        baseFilter.parent_id = { $in: validatedParentIds };
      }
      if (top_level) {
        baseFilter.top_level = top_level == "true" ? true : false;
      }
      if (locationId) {
        const validatedLocationId = helperService.validateObjectId(String(locationId));
        const childIds = await locationService.getAllChildLocationIds(String(validatedLocationId));
        if (user.user_role !== "admin") {
          const mappedData = await mapUserToLocationService.getDataByLocationIds([String(validatedLocationId), ...childIds]);
          baseFilter.locationId = { $in: mappedData.map((doc) => doc.locationId) };
        } else {
          baseFilter.locationId = { $in: [validatedLocationId, ...childIds.map(id => helperService.validateObjectId(id))] };
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
      if (top_level_asset_id) {
        baseFilter.top_level_asset_id = helperService.validateObjectIds(String(top_level_asset_id));
      }
      if (top_level) {
        baseFilter.top_level = top_level == "true" ? true : false;
      }
      if (locationId) {
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
      const childIds = await assetService.getAllChildAssetIDs(helperService.validateObjectId(String(id)));
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
        baseFilter.$or = [
          { _id: { $in: helperService.validateObjectIds(String(id)) } },
          { parent_id: { $in: helperService.validateObjectIds(String(id)) } },
        ];
      }
      if (location_id) {
        baseFilter.locationId = {
          $in: helperService.validateObjectIds(String(location_id)),
        };
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        mapping: "asset",
        idField: "_id",
      });
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
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { locationList = [], assets = [], top_level } = req.body;
      const match: any = { account_id, visible: true };
      if (userRole !== "admin") {
        const mapData = await mapUserToAssetService.getAssetsMappedData(user_id);
        if (!mapData || mapData.length === 0) {
          throw Object.assign(new Error("Asset not found"), { status: 404 });
        }
        match._id = { $in: mapData.map((doc) => doc.assetId) };
      }
      if (top_level) {
        match.top_level = top_level;
      }
      if (locationList && locationList.length > 0) {
        match.locationId = { $in: locationList };
        if (userRole !== "admin") {
          const mapData = await mapUserToAssetService.getAssetsMappedData(user_id);
          match._id = { $in: mapData.map((doc) => doc.assetId) };
        }
      }
      if (assets && assets.length > 0) {
        match._id = { $in: assets };
      }
      const data = await assetService.getAllAssets(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("No assets found matching the filter"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Filtered assets retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  };

  createOld = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    var data: any;
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", {}) as string;
      const { body } = req;
      if (body.userIdList?.length === 0) {
        throw Object.assign(new Error("Please select at least one user"), { status: 400 });
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
      const insertedData: any = await assetService.getAllAssets({ _id: data._id });
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
      const { params: { id }, body } = req;
      if (body.userIdList?.length === 0) {
        throw Object.assign(new Error("Please select at least one user"), { status: 400 });
      }
      const existingData: any = await assetService.getAllAssets({ _id: helperService.validateObjectId(String(id)), account_id, visible: true });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      if (body.locationId !== existingData[0].locationId) {
        await assetService.updateAllChildAssetsLocation(
          helperService.validateObjectId(String(id)), body.locationId, user_id);
      }
      const data = await assetService.updateAssetOld(helperService.validateObjectId(String(id)), body, user_id);
      if (!data) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      const insertedData: any = await assetService.getAllAssets({
        _id: helperService.validateObjectId(String(id)),
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
      const {
        account_id,
        _id: user_id,
        user_role: userRole,
      } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      let { assetList } = req.query;
      if (assetList && assetList.toString().split(",").length > 0) {
        match._id = helperService.validateObjectIds(String(assetList));
      }
      if (userRole !== "admin") {
        const mapData =
          await mapUserToAssetService.getAssetsMappedData(user_id);
        if (mapData && mapData.length > 0) {
          match._id = { $in: mapData.map((doc: any) => doc.assetId) };
        }
      }
      const data = await assetService.getAssetDataSensorList(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("Asset sensor list not found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Asset sensor list fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  getFilteredAssetSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const {
        account_id,
        _id: user_id,
        user_role: userRole,
      } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      let { assetList } = req.body;
      if (assetList && assetList.length > 0) {
        match._id = { $in: helperService.validateObjectIds(String(assetList)) };
      }
      if (userRole !== "admin") {
        const mapData =
          await mapUserToAssetService.getAssetsMappedData(user_id);
        if (mapData && mapData.length > 0) {
          match._id = { $in: mapData.map((doc: any) => doc.assetId) };
        }
      }
      const data = await assetService.getAssetDataSensorList(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error("Asset sensor list not found"), { status: 404 });
      }
      res
        .status(200)
        .json({ status: true, message: "Asset sensor list fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };

  makeAssetCopy = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const userToken = get(req, "userToken", "") as string;
      const { params: { id } } = req;

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
}

export const assetController = new AssetController();
