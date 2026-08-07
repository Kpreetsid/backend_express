import { NextFunction, Request, Response } from 'express';
import { get } from "lodash";
import { assetService } from './asset.service';
import { IUser } from '../../models/user.model';
import { mapUserToAssetService } from '../../transaction/mapUserAsset/userAsset.service';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { locationService } from '../location/location.service';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from "../../utils/transaction.helper";
import { requireActiveTenantUsers } from '../../utils/tenant-users';
import { queueAssetHealthInitialization } from '../../queue/processor-events';
import {
  synchronizeAssetHealthInitialization
} from '../../queue/handlers/asset-health-initialization.handler';
import { randomUUID } from 'node:crypto';

const sanitizeAssetBody = (body: Record<string, unknown>): any => {
  const sanitized: any = { ...body };
  for (const field of ['_id', 'id', 'account_id', 'createdBy', 'updatedBy', 'visible']) {
    delete sanitized[field];
  }
  return sanitized;
};

const resolveScopedAssetIds = async (
  userId: unknown,
  userRole: string,
  requestedIds?: unknown
): Promise<any[] | undefined> => {
  const validatedRequestedIds =
    Array.isArray(requestedIds) && requestedIds.length > 0
      ? helperService.validateObjectIds(requestedIds)
      : typeof requestedIds === "string" && requestedIds.trim()
        ? helperService.validateObjectIds(requestedIds)
        : undefined;

  if (userRole === "admin") {
    return validatedRequestedIds;
  }

  const mappedAssets = await mapUserToAssetService.getAssetsMappedData(userId);
  const mappedIds = (mappedAssets || []).map((doc: any) => doc.assetId);
  if (!validatedRequestedIds) {
    return mappedIds;
  }

  const requestedIdSet = new Set(validatedRequestedIds.map((id) => String(id)));
  return mappedIds.filter((id: any) => requestedIdSet.has(String(id)));
};

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
        const validatedLocationIds = helperService.validateObjectIds(String(locationId));
        const rootLocationIds = validatedLocationIds.map((id) => String(id));
        const childLocationGroups = await Promise.all(rootLocationIds.map((id) => locationService.getAllChildLocationIds(id)));
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
      if (!Array.isArray(body)) {
        throw Object.assign(new Error("Buzzer asset list must be an array"), { status: 400 });
      }
      if (data.length !== body.length) {
        throw Object.assign(new Error("Invalid asset list count"), { status: 400 });
      }
      const scopedAssetIds = data.map((asset: any) => String(asset._id || asset.id));
      const scopedAssetIdSet = new Set(scopedAssetIds);
      const requestedAssetIds = body.map((asset: any) => {
        if (!asset?.id || typeof asset.isBuzzerActive !== "boolean") {
          throw Object.assign(new Error("Invalid buzzer asset item"), { status: 400 });
        }
        return String(helperService.validateObjectId(String(asset.id)));
      });
      if (
        new Set(requestedAssetIds).size !== requestedAssetIds.length ||
        requestedAssetIds.some((id: string) => !scopedAssetIdSet.has(id))
      ) {
        throw Object.assign(new Error("Invalid buzzer asset scope"), { status: 400 });
      }
      await assetService.updateBuzzerAssetList(body, {
        accountId: user.account_id,
        assetIds: scopedAssetIds,
      });
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
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { locationList = [], assets = [], top_level } = req.body;
      const match: any = { account_id, visible: true };
      const scopedAssetIds = await resolveScopedAssetIds(user_id, userRole, assets);
      if (scopedAssetIds) {
        match._id = { $in: scopedAssetIds };
      }
      if (top_level) {
        match.top_level = top_level;
      }
      if (locationList && locationList.length > 0) {
        match.locationId = { $in: helperService.validateObjectIds(locationList) };
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
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = sanitizeAssetBody(req.body);
      if (!Array.isArray(body.userIdList) || body.userIdList.length === 0) {
        throw Object.assign(new Error("Please select at least one user"), { status: 400 });
      }
      const correlationId = String(res.locals['correlationId'] || randomUUID());
      const result = await withTransaction(async (session) => {
        const tenantUserIds = await requireActiveTenantUsers(
          body.userIdList,
          account_id,
          session
        );
        const tenantBody = { ...body, userIdList: tenantUserIds };
        await assetService.requireTenantReferences(tenantBody, account_id, session);
        const created = await assetService.createAssetOld(
          tenantBody,
          account_id,
          user_id,
          session
        );
        const alarmTypes = Array.isArray(tenantBody.alarmType)
          ? tenantBody.alarmType
          : [];
        const assetsMapData = tenantUserIds.map((user: any) => ({
          account_id,
          userId: user,
          assetId: created._id,
          sendMail: alarmTypes.includes("sendMail"),
          alert: alarmTypes.includes("alert"),
          danger: alarmTypes.includes("danger"),
          critical: alarmTypes.includes("critical"),
        }));
        await mapUserToAssetService.createMapUserAssets(assetsMapData, session);
        const processorQueued = await queueAssetHealthInitialization({
          assetIds: [String(created._id)],
          tenantId: String(account_id),
          actorId: String(user_id),
          correlationId
        }, session);
        await notificationService.queueAccountNotification({
          accountId: String(account_id),
          module: 'Asset',
          event: 'created',
          entityId: String(created._id),
          entityName: created.asset_name || tenantBody.asset_name || 'Asset',
          actionUrl: `/assets/asset-health/${created._id}/health`,
          sourceUserId: String(user_id)
        }, { session, correlationId });
        return { created, processorQueued };
      });
      if (!result.processorQueued) {
        await synchronizeAssetHealthInitialization(
          [String(result.created._id)],
          String(account_id),
          String(user_id)
        );
      }
      const insertedData: any = await assetService.getAllAssets({
        _id: result.created._id,
        account_id,
        visible: true
      });
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Asset created successfully", data: insertedData });
    } catch (error) {
      next(error);
    }
  };

  updateOld = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const body = sanitizeAssetBody(req.body);
      if (!Array.isArray(body.userIdList) || body.userIdList.length === 0) {
        throw Object.assign(new Error("Please select at least one user"), { status: 400 });
      }
      const assetId = helperService.validateObjectId(String(id));
      const existingData: any = await assetService.getAllAssets({
        _id: assetId,
        account_id,
        visible: true
      });
      if (!existingData || existingData.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
      const correlationId = String(res.locals['correlationId'] || randomUUID());
      await withTransaction(async (session) => {
        const tenantUserIds = await requireActiveTenantUsers(
          body.userIdList,
          account_id,
          session
        );
        const tenantBody = { ...body, userIdList: tenantUserIds };
        await assetService.requireTenantReferences(tenantBody, account_id, session);
        const existingLocationId = String(
          existingData[0].locationId?._id || existingData[0].locationId || ''
        );
        if (tenantBody.locationId && String(tenantBody.locationId) !== existingLocationId) {
          await assetService.updateAllChildAssetsLocation(
            assetId,
            tenantBody.locationId,
            account_id,
            user_id,
            session
          );
        }
        const updated = await assetService.updateAssetOld(
          assetId,
          tenantBody,
          account_id,
          user_id,
          session
        );
        if (!updated) {
          throw Object.assign(new Error("Asset not found"), { status: 404 });
        }
        await notificationService.queueAccountNotification({
          accountId: String(account_id),
          module: 'Asset',
          event: 'updated',
          entityId: String(id),
          entityName: updated.asset_name || tenantBody.asset_name || 'Asset',
          actionUrl: `/assets/asset-health/${id}/health`,
          sourceUserId: String(user_id)
        }, { session, correlationId });
      });
      const insertedData: any = await assetService.getAllAssets({
        _id: assetId,
        account_id,
        visible: true
      });
      if (!insertedData || insertedData.length === 0) {
        throw Object.assign(new Error("Asset not found"), { status: 404 });
      }
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
      const { assetList } = req.query;
      const scopedAssetIds = await resolveScopedAssetIds(user_id, userRole, assetList);
      if (scopedAssetIds) {
        match._id = { $in: scopedAssetIds };
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
      const { assetList } = req.body;
      const scopedAssetIds = await resolveScopedAssetIds(user_id, userRole, assetList);
      if (scopedAssetIds) {
        match._id = { $in: scopedAssetIds };
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
      const { params: { id } } = req;
      const correlationId = String(res.locals['correlationId'] || randomUUID());

      const result = await withTransaction(async (session: any) => {
        const newParentId = await assetService.makeAssetCopyRecursive(
          String(id),
          user_id,
          account_id,
          undefined,
          session,
          correlationId
        );
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
