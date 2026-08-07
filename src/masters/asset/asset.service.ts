import { applicationLogger } from '../../observability/logger';
import { AssetModel } from '../../models/asset.model';
import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { mapUserToAssetService } from "../../transaction/mapUserAsset/userAsset.service";
import { helperService } from '../../utils/helper';
import { WorkOrderModel } from '../../models/workOrder.model';
import { ObservationModel } from '../../models/observation.model';
import { ReportAssetModel } from '../../models/assetReport.model';
import { InspectionModel } from '../../models/inspection.model';
import { WorkRequestModel } from '../../models/workRequest.model';
import { LocationModel } from '../../models/location.model';

import { withTransaction } from "../../utils/transaction.helper";
import { ClientSession } from "mongoose";
import {
  queueAssetEndpointClone,
  queueAssetHealthInitialization
} from "../../queue/processor-events";
import { synchronizeAssetEndpointClone } from "../../queue/handlers/asset-endpoint-clone.handler";
import {
  synchronizeAssetHealthInitialization
} from "../../queue/handlers/asset-health-initialization.handler";
import { randomUUID } from "node:crypto";

class AssetService {
  async getAllAssets(match: any) {
    const assetsData = await AssetModel.find(match).populate([
        { path: 'locationId', model: "Schema_Location", select: 'id location_name location_type top_level parent_id visible assigned_to', match: { visible: true } }, 
        { path: 'parent_id', model: "Schema_Asset", select: 'id asset_name asset_type asset_model top_level parent_id visible', match: { visible: true } }
    ]);
    
    if (!assetsData.length) return [];

    const assetsIds = assetsData.map((asset: any) => asset._id);
    const mapData = await MapUserAssetLocationModel.find({ 
        assetId: { $in: assetsIds }, 
        userId: { $exists: true } 
    }).populate([{ path: 'userId', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }]);

    const mappingsByAsset = new Map<string, any[]>();
    mapData.forEach(map => {
        const aId = String(map.assetId);
        if (!mappingsByAsset.has(aId)) {
            mappingsByAsset.set(aId, []);
        }
        if (map.userId) {
            mappingsByAsset.get(aId)?.push(map.userId);
        }
    });

    const result: any = assetsData.map((doc: any) => {
      const obj = doc.toObject();
      const id = String(obj._id);
      
      if (obj.locationId) {
        obj.locationId.id = obj.locationId._id;
      }
      if (obj.parent_id) {
        obj.parent_id.id = obj.parent_id._id;
      }
      obj.id = id;
      obj.userList = mappingsByAsset.get(id) || [];
      return obj;
    });

    return result;
  }

  async buzzerAssetList(match: any): Promise<any> {
    return await AssetModel.find(match).select('id asset_name isBuzzerActive');
  }

  async updateBuzzerAssetList(
    body: any,
    scope: { accountId: unknown; assetIds: string[] }
  ) {
    if (!body.length) return;
    const allowedAssetIds = new Set(scope.assetIds.map((id) => String(id)));
    const bulkOps = body.map((item: any) => {
      if (typeof item?.isBuzzerActive !== "boolean") {
        throw Object.assign(new Error("isBuzzerActive must be a boolean"), { status: 400 });
      }
      const assetId = String(helperService.validateObjectId(String(item.id)));
      if (!allowedAssetIds.has(assetId)) {
        throw Object.assign(new Error("Asset is outside the authorized scope"), { status: 403 });
      }
      return {
        updateOne: {
          filter: {
            _id: helperService.validateObjectId(assetId),
            account_id: scope.accountId,
            visible: true
          },
          update: { $set: { isBuzzerActive: item.isBuzzerActive } }
        }
      };
    });
    await AssetModel.bulkWrite(bulkOps);
  }

  async getAllChildAssetIDs(assetId: any): Promise<string[]> {
    const children = await AssetModel.find({ parent_id: assetId, visible: true }).select('_id');
    if (!children || children.length === 0) {
      return [assetId];
    }
    const allChildIds: string[] = [];
    for (const child of children) {
      const subChildIds = await this.getAllChildAssetIDs(child._id);
      allChildIds.push(...subChildIds);
    }
    return [assetId, ...allChildIds];
  };

  async getAssetsTreeData(match: any): Promise<any> {
    const asset_type_list: string[] = ["Rigid", "Flexible"];
    match.asset_type = { $nin: asset_type_list };
    const allAssets = await AssetModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { locationId: '$locationId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$locationId'] } } },
            { $project: { _id: 1, id: "$_id", location_name: 1, location_type: 1, visible: 1 } },
          ],
          as: 'locationData'
        }
      },
      { $unwind: { path: '$locationData', preserveNullAndEmptyArrays: true } }
    ]);
    if (!allAssets.length) {
      throw Object.assign(new Error("No records found"), { status: 404 });
    }
    const data = await this.buildAssetsTree(allAssets);
    return data;
  };

  buildAssetsTree = async (assets: any[]) => {
    if (!Array.isArray(assets) || !assets.length) return [];
    const childrenMap = new Map<string, any[]>();
    const rootNodes: any[] = [];
    for (const asset of assets) {
      const parent = asset.parent_id ? String(asset.parent_id) : null;
      if (!parent) {
        rootNodes.push(asset);
      }
      const parentKey = parent ?? "ROOT";
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)?.push(asset);
    }
    const attachChildren = (node: any) => {
      const nodeId = String(node._id);
      node.id = nodeId;
      node.childs = (childrenMap.get(nodeId) || []).map((child) =>
        attachChildren(child)
      );
      return node;
    };
    return rootNodes.map((root) => attachChildren(root));
  };

  async updateAssetImageById(id: any, image_path: string, user_id: any) {
    return await AssetModel.findOneAndUpdate({ _id: id }, { image_path: image_path, updatedBy: user_id }, { returnDocument: 'after' });
  }

  async removeById(match: any, userID: any) {
    return await withTransaction(async (session) => {
      const parentId = String(match._id);
      const account_id = match.account_id;
      const childAssets = await this.getAllChildAssetsRecursive(parentId, account_id);
      const totalIds = [parentId, ...childAssets.map(a => String(a._id))];
      const objectIds = helperService.validateObjectIds(totalIds);
      
      const updateQuery = { $set: { visible: false, updatedBy: userID } };
      
      await AssetModel.updateMany({ _id: { $in: objectIds } }, updateQuery, { session });
      await WorkOrderModel.updateMany({ wo_asset_id: { $in: objectIds } }, updateQuery, { session });
      await ObservationModel.updateMany({ assetId: { $in: objectIds } }, updateQuery, { session });
      await ReportAssetModel.updateMany({ assetId: { $in: objectIds } }, updateQuery, { session });
      await InspectionModel.updateMany({ asset_id: { $in: objectIds } }, updateQuery, { session });
      await WorkRequestModel.updateMany({ asset_id: { $in: objectIds } }, updateQuery, { session });
      
      await mapUserToAssetService.removeAssetListMapping(totalIds, session);
      return true;
    });
  };

  async deleteAsset(id: string): Promise<any> {
    const childAssets = await AssetModel.find({ parent_id: id });
    if (childAssets && childAssets.length > 0) {
      for (const asset of childAssets) {
        await mapUserToAssetService.removeAssetMapping(`${asset._id}`);
      }
      await AssetModel.deleteMany({ parent_id: id });
    }
    await mapUserToAssetService.removeAssetMapping(id);
    return await AssetModel.deleteOne({ _id: id });
  }

  async getAssetDataSensorList(match: any): Promise<any> {
    const data = await AssetModel.find(match).populate([
      { path: 'locationId', model: "Schema_Location", select: 'id location_name' },
      { path: 'top_level_asset_id', model: "Schema_Asset", select: 'id asset_name' },
      { path: 'account_id', model: "Schema_Account", select: 'id account_name' }
    ]);
    if (data.length === 0) {
      throw Object.assign(new Error('No records found'), { status: 404 });
    }
    const result = data.map((doc: any) => {
      doc = doc.toObject();
      return {
        "asset_id": doc._id,
        "asset_name": doc.asset_name,
        "top_level_asset_id": doc.top_level_asset_id ? doc.top_level_asset_id._id : "",
        "top_level_asset_name": doc.top_level_asset_id ? doc.top_level_asset_id?.asset_name : "NA",
        "location_id": doc.locationId ? doc.locationId._id : "",
        "location_name": doc.locationId ? doc.locationId.location_name : "NA",
        "company_name": doc.account_id ? doc.account_id.account_name : "NA"
      };
    })
    return result;
  }

  async requireTenantReferences(
    body: any,
    account_id: any,
    session?: ClientSession
  ): Promise<void> {
    const locationQuery = body.locationId
      ? LocationModel.countDocuments({
        _id: body.locationId,
        account_id,
        visible: true
      })
      : null;
    const referencedAssetIds = [...new Set(
      [body.parent_id, body.top_level_asset_id]
        .filter(Boolean)
        .map((id) => String(id))
    )];
    const assetQuery = AssetModel.countDocuments({
      _id: { $in: referencedAssetIds },
      account_id,
      visible: true
    });
    if (session) {
      locationQuery?.session(session);
      assetQuery.session(session);
    }
    const [locationCount, assetCount] = await Promise.all([
      locationQuery || Promise.resolve(0),
      referencedAssetIds.length ? assetQuery : Promise.resolve(0)
    ]);
    if (
      (body.locationId && locationCount !== 1)
      || (referencedAssetIds.length && assetCount !== referencedAssetIds.length)
    ) {
      throw Object.assign(new Error('Asset location or parent not found'), { status: 404 });
    }
  }

  async createAssetOld(
    body: any,
    account_id: any,
    user_id: any,
    session?: ClientSession
  ): Promise<any> {
    const data: any = new AssetModel({ ...body, account_id, createdBy: user_id });
    data.top_level_asset_id = data.top_level_asset_id ? data.top_level_asset_id : data._id;
    return await data.save(session ? { session } : {});
  }

  async updateAssetOld(
    id: any,
    body: any,
    account_id: any,
    user_id: any,
    existingSession?: ClientSession
  ): Promise<any> {
    return await withTransaction(async (session) => {
      await mapUserToAssetService.updateUserMapping(
        String(id),
        body.userIdList,
        [],
        [],
        session
      );
      await mapUserToAssetService.updateFlagOnAssetUpdate(
        String(id),
        body.userIdList,
        body.alarmType,
        session
      );
      return await AssetModel.findOneAndUpdate(
        { _id: id, account_id, visible: true },
        { ...body, account_id, updatedBy: user_id },
        { returnDocument: 'after', session }
      );
    }, existingSession);
  }

  async updateAllChildAssetsLocation(
    id: any,
    locationId: any,
    account_id: any,
    user_id: any,
    session?: ClientSession
  ): Promise<any> {
    const childAssets = await AssetModel.find({
      parent_id: id,
      account_id,
      visible: true
    }).session(session || null);
    if (childAssets && childAssets.length > 0) {
      for (const asset of childAssets) {
        await this.updateAllChildAssetsLocation(
          `${asset._id}`,
          locationId,
          account_id,
          user_id,
          session
        );
      }
      return await AssetModel.updateMany(
        { parent_id: id, account_id, visible: true },
        { locationId: locationId, updatedBy: user_id },
        session ? { session } : {}
      );
    }
  }

  async deleteAssetsById(assetId: any) {
    const childData = await AssetModel.find({ parent_id: assetId });
    if (childData.length > 0) {
      for (const asset of childData) {
        await mapUserToAssetService.removeAssetMapping(`${asset._id}`);
      }
      await AssetModel.deleteMany({ _id: { $in: childData.map(doc => doc._id) } });
    }
    await AssetModel.deleteMany({ _id: assetId });
    await mapUserToAssetService.removeAssetMapping(assetId);
  }

  async getAllChildAssetsRecursive(parentId: string, account_id: any): Promise<any[]> {
    const children = await AssetModel.find({ parent_id: parentId, account_id, visible: true }).lean();
    const all: any[] = [];
    for (const child of children) {
      if (child._id?.toString() === parentId) continue;
      all.push(child);
      const subChildren = await this.getAllChildAssetsRecursive(child._id.toString(), account_id);
      all.push(...subChildren);
    }
    return all;
  };

  async makeAssetCopyRecursive(
    id: string,
    user_id: any,
    account_id: any,
    targetLocationId?: any,
    session?: any,
    correlationId?: string
  ): Promise<any> {
    const eventCorrelationId = correlationId || randomUUID();
    const dataExists: any = await AssetModel.find({
      _id: helperService.validateObjectId(String(id)),
      account_id,
      visible: true,
    }).session(session);
    if (!dataExists || dataExists.length === 0) return null;

    const sourceAsset = dataExists[0].toObject();
    const allChildren: any[] = await this.getAllChildAssetsRecursive(String(id), account_id);
    const idMap: Record<string, any> = {};
    
    const originalTopLevelId = sourceAsset.top_level ? sourceAsset._id : sourceAsset.top_level_asset_id;
    const parentForCopy = sourceAsset.parent_id ? sourceAsset.parent_id : undefined;

    const newParentId = await this.makeAssetCopyByIdWithChildren(
      sourceAsset,
      user_id,
      account_id,
      parentForCopy,
      idMap,
      null,
      session,
      targetLocationId,
      eventCorrelationId
    );

    const newTopLevelId = sourceAsset.top_level ? newParentId : originalTopLevelId;
    idMap[`${sourceAsset._id}`] = newParentId;

    for (const child of allChildren) {
      const childObj = child.toObject ? child.toObject() : child;
      const newParent = idMap[childObj.parent_id?.toString()] || newParentId;
      const newChildId = await this.makeAssetCopyByIdWithChildren(
        childObj,
        user_id,
        account_id,
        newParent,
        idMap,
        newTopLevelId,
        session,
        targetLocationId,
        eventCorrelationId
      );
      idMap[childObj._id.toString()] = newChildId;
    }

    const createdAssetIds = [
      String(newParentId),
      ...allChildren.map((child) => String(idMap[child._id.toString()]))
    ];
    const healthQueued = await queueAssetHealthInitialization({
      assetIds: createdAssetIds,
      tenantId: String(account_id),
      actorId: String(user_id),
      correlationId: eventCorrelationId
    }, session);
    if (!healthQueued) {
      await synchronizeAssetHealthInitialization(
        createdAssetIds,
        String(account_id),
        String(user_id)
      );
    }

    return newParentId;
  }

  async cloneAssetsByLocation(
    oldLocationId: string,
    newLocationId: string,
    account_id: any,
    user_id: any,
    session?: any,
    correlationId?: string
  ) {
    const topLevelAssets = await AssetModel.find({
      locationId: helperService.validateObjectId(oldLocationId),
      $or: [
        { parent_id: { $exists: false } },
        { parent_id: null },
        { top_level: true }
      ],
      visible: true,
      account_id
    }).session(session);

    for (const asset of topLevelAssets) {
      await this.makeAssetCopyRecursive(
        String(asset._id),
        user_id,
        account_id,
        newLocationId,
        session,
        correlationId
      );
    }
  }

  async makeAssetCopyByIdWithChildren(
    sourceAsset: any,
    user_id: any,
    account_id: any,
    newParentId?: any,
    idMap?: any,
    newTopLevelId?: any,
    session?: any,
    newLocationId?: any,
    correlationId?: string
  ): Promise<any> {
    return await withTransaction(async (innerSession) => {
      const activeSession = session || innerSession;
      const { createdAt, updatedAt, _id, id, ...rest } = sourceAsset;
      const cleanAsset = JSON.parse(JSON.stringify(rest));
      delete cleanAsset._id;
      delete cleanAsset.id;
      delete cleanAsset.createdAt;
      delete cleanAsset.updatedAt;
      if (!cleanAsset.asset_name) cleanAsset.asset_name = "Unnamed Asset";
      if (!cleanAsset.account_id) cleanAsset.account_id = account_id;
      const baseName = (sourceAsset.asset_name || "Asset").replace(/\s-\s(Copy|\(\d+\))$/, "");
      const existingCount = await AssetModel.countDocuments({
        parent_id: newParentId || { $exists: false },
        account_id,
        asset_name: { $regex: `^${baseName} - Copy`, $options: "i" },
        visible: true
      }).session(activeSession);
      const newName = existingCount > 0 ? `${baseName} - Copy (${existingCount + 1})` : `${baseName} - Copy`;
      let topLevelRef: any = null;
      if (sourceAsset.top_level) {
        topLevelRef = undefined;
      } else if (newTopLevelId) {
        topLevelRef = newTopLevelId;
      } else {
        topLevelRef = sourceAsset.top_level_asset_id;
      }
      const newAssetData: any = {
        ...cleanAsset,
        asset_name: newName,
        asset_type: sourceAsset.asset_type || "Other",
        createdBy: user_id,
        updatedBy: undefined,
        account_id,
        visible: true,
        parent_id: newParentId ? helperService.validateObjectId(String(newParentId)) : undefined,
        top_level_asset_id: topLevelRef,
        locationId: newLocationId || sourceAsset.locationId
      };
      const newAsset = new AssetModel(newAssetData);
      const savedAsset: any = await newAsset.save({ session: activeSession });
      if (sourceAsset.top_level) {
        savedAsset.top_level_asset_id = savedAsset._id;
        await savedAsset.save({ session: activeSession });
      }
      let userList: any[] = [];
      try {
        const userMappings = await mapUserToAssetService.getDataByAssetId(
          `${sourceAsset.id || sourceAsset._id}`,
          activeSession
        );
        userList = userMappings.map((doc: any) => doc.userId).filter(Boolean);
      } catch { }
      const sourceAssetId = String(sourceAsset.id || sourceAsset._id);
      const targetAssetId = String(savedAsset._id);
      const eventCorrelationId = correlationId || randomUUID();
      const endpointCloneQueued = await queueAssetEndpointClone({
        sourceAssetId,
        targetAssetId,
        tenantId: String(account_id),
        actorId: String(user_id),
        correlationId: eventCorrelationId
      }, activeSession);
      if (!endpointCloneQueued) {
        try {
          await synchronizeAssetEndpointClone(
            sourceAssetId,
            targetAssetId,
            String(account_id),
            String(user_id),
            `${eventCorrelationId}:${targetAssetId}`
          );
        } catch (err) {
          applicationLogger.error({ err }, "Endpoint copy failed:");
        }
      }
      if (userList.length > 0) {
        const mappedData = userList.map((u: any) => ({ assetId: savedAsset._id, userId: u, account_id }));
        await mapUserToAssetService.createMapUserAssets(mappedData, activeSession);

        if (newLocationId) {
          const locId = helperService.validateObjectId(String(newLocationId));
          const userIds = userList.map(u => helperService.validateObjectId(String(u)));
          for (const uId of userIds) {
            await MapUserAssetLocationModel.updateOne(
              { locationId: locId, userId: uId },
              { $set: { locationId: locId, userId: uId, account_id } },
              { upsert: true, session: activeSession }
            );
          }
        }
      }
      return savedAsset._id;
    }, session);
  };
}

export const assetService = new AssetService();
