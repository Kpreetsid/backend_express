import { AssetModel } from '../../models/asset.model';
import { NextFunction, Request, Response } from 'express';
import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { createMapUserAssets, getDataByAssetId, removeAssetMapping } from "../../transaction/mapUserLocation/userLocation.service";
import { IUser } from "../../models/user.model";
import { get } from "lodash";
import { getExternalData } from "../../util/externalAPI";
import mongoose from 'mongoose';

export const getAllAssets = async (match: any) => {
  const assetsData = await AssetModel.find(match).populate([{ path: 'locationId', model: "Schema_Location", select: 'id location_name assigned_to' }, { path: 'parent_id', model: "Schema_Asset", select: 'id asset_name' }]);
  const assetsIds = assetsData.map((asset: any) => `${asset._id}`);
  const mapData = await MapUserAssetLocationModel.find({ assetId: { $in: assetsIds }, userId: { $exists: true } }).populate([{ path: 'userId', model: "Schema_User", select: 'id firstName lastName' }]);
  const result: any = assetsData.map((doc: any) => {
    const { _id: id, ...obj } = doc.toObject();
    if (obj.locationId) {
      obj.locationId.id = obj.locationId._id;
    }
    if (obj.parent_id) {
      obj.parent_id.id = obj.parent_id._id;
    }
    obj.id = id;
    const mappedUser = mapData.filter(map => `${map.assetId}` === `${id}`);
    obj.userList = mappedUser.length > 0 ? mappedUser.map((a: any) => a.userId).filter((user: any) => user) : [];
    return obj;
  });
  return result;
}

export const buzzerAssetList = async (match: any): Promise<any> => {
  return await AssetModel.find(match).select('id asset_name isBuzzerActive');
}

export const updateBuzzerAssetList = async (body: any) => {
  await body.forEach(async (item: any) => {
    await AssetModel.updateOne({ _id: item.id }, { isBuzzerActive: item.isBuzzerActive });
  })
}

export const getAllChildAssetIDs = async (assetId: any): Promise<string[]> => {
  const children = await AssetModel.find({ parent_id: assetId, visible: true }).select('_id');
  if (!children || children.length === 0) {
    return [assetId];
  }
  const allChildIds: string[] = [];
  for (const child of children) {
    const subChildIds = await getAllChildAssetIDs(child._id);
    allChildIds.push(...subChildIds);
  }
  return [assetId, ...allChildIds];
};

export const getAssetsTreeData = async (match: any): Promise<any> => {
  const allAssets = await AssetModel.find(match).lean();
  if (!allAssets.length) {
    throw Object.assign(new Error("No data found"), { status: 404 });
  }
  const data = buildAssetsTree(allAssets);
  return data;
};

export const buildAssetsTree = (assets: any[]) => {
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

export const updateAssetImageById = async (id: string, image_path: string, user_id: string) => {
  return await AssetModel.findOneAndUpdate({ _id: id }, { image_path: image_path, updatedBy: user_id }, { new: true });
}

export const removeById = async (match: any, userID: any) => {
  const childAssets = await AssetModel.find({ parent_id: match._id });
  if (childAssets && childAssets.length > 0) {
    await AssetModel.updateMany({ parent_id: match._id }, { visible: false, updatedBy: userID });
  }
  // await removeLocationMapping(req.params.id);
  return await AssetModel.findOneAndUpdate(match, { visible: false, updatedBy: userID }, { new: true });
};

export const deleteAsset = async (id: string): Promise<any> => {
  const childAssets = await AssetModel.find({ parent_id: id });
  if (childAssets && childAssets.length > 0) {
    for (const asset of childAssets) {
      await removeAssetMapping(`${asset._id}`);
    }
    await AssetModel.deleteMany({ parent_id: id });
  }
  await removeAssetMapping(id);
  return await AssetModel.deleteOne({ _id: id });
}

export const getAssetDataSensorList = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    let { assetList } = req.query;
    if (assetList && assetList.toString().split(',').length > 0) {
      match._id = { $in: assetList.toString().split(',') };
    }
    if (userRole !== 'admin') {
      const mapData = await MapUserAssetLocationModel.find({ userId: user_id });
      if (mapData && mapData.length > 0) {
        match._id = { $in: mapData.map((doc: any) => doc.assetId) };
      }
    }
    const data = await AssetModel.find(match).populate([
      { path: 'locationId', model: "Schema_Location", select: 'id location_name' },
      { path: 'top_level_asset_id', model: "Schema_Asset", select: 'id asset_name' },
      { path: 'account_id', model: "Schema_Account", select: 'id account_name' }
    ]);
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
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
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: result });
  } catch (error) {
    next(error);
  }
}

export const createAssetOld = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const data: any = new AssetModel({ ...body, account_id, createdBy: user_id });
  data.top_level_asset_id = data.top_level_asset_id ? data.top_level_asset_id : data._id;
  return await data.save();
}

export const updateAssetOld = async (id: any, body: any, user_id: any): Promise<any> => {
  return await AssetModel.findOneAndUpdate({ _id: id }, { ...body, updatedBy: user_id }, { new: true });
}

export const updateAllChildAssetsLocation = async (id: any, locationId: any, user_id: any): Promise<any> => {
  const childAssets = await AssetModel.find({ parent_id: id });
  if (childAssets && childAssets.length > 0) {
    for (const asset of childAssets) {
      await updateAllChildAssetsLocation(`${asset._id}`, locationId, user_id);
    }
    return await AssetModel.updateMany({ parent_id: id }, { locationId: locationId, updatedBy: user_id });
  }
}

export const deleteAssetsById = async (assetId: any) => {
  const childData = await AssetModel.find({ parent_id: assetId });
  if (childData.length > 0) {
    for (const asset of childData) {
      await removeAssetMapping(`${asset._id}`);
    }
    await AssetModel.deleteMany({ _id: { $in: childData.map(doc => doc._id) } });
  }
  await AssetModel.deleteMany({ _id: assetId });
  await removeAssetMapping(assetId);
}

export const getAllChildAssetsRecursive = async (parentId: string, account_id: any): Promise<any[]> => {
  const children = await AssetModel.find({ parent_id: parentId, account_id, visible: true }).lean();
  const all: any[] = [];
  for (const child of children) {
    if (child._id?.toString() === parentId) continue;
    all.push(child);
    const subChildren = await getAllChildAssetsRecursive(child._id.toString(), account_id);
    all.push(...subChildren);
  }
  return all;
};

export const makeAssetCopyByIdWithChildren = async (sourceAsset: any, user_id: any, token: string, account_id: any, newParentId?: any, idMap?: any, newTopLevelId?: any): Promise<any> => {
  try {
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
    });
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
      parent_id: newParentId ? new mongoose.Types.ObjectId(newParentId) : undefined,
      top_level_asset_id: topLevelRef
    };
    const newAsset = new AssetModel(newAssetData);
    const savedAsset: any = await newAsset.save();
    if (sourceAsset.top_level) {
      savedAsset.top_level_asset_id = savedAsset._id;
      await savedAsset.save();
    }
    let userList: any[] = [];
    try {
      const userMappings = await getDataByAssetId(`${sourceAsset.id || sourceAsset._id}`);
      userList = userMappings.map((doc: any) => doc.userId).filter(Boolean);
    } catch {}
    try {
      const endPointList: any = await getAssetEndPoints([`${sourceAsset.id || sourceAsset._id}`], token, user_id);
      if (endPointList?.data?.length > 0) {
        for (const item of endPointList.data) {
          const newEndPointPayload = {
            org_id: item.org_id,
            point_name: item.point_name,
            asset_id: savedAsset._id.toString(),
            mount_location: item.mount_location,
            rpm: item.rpm || "",
            bsf: item.bsf || "",
            ftf: item.ftf || "",
            bpfo: item.bpfo || "",
            bpfi: item.bpfi || "",
            bearing_number: item.bearing_number || "",
            parent_asset_id: newParentId || null
          };
          await createEndPointCopy(newEndPointPayload, user_id, token);
        }
      }
    } catch (err) {
      console.error("Endpoint copy failed:", err);
    }
    if (userList.length > 0) {
      const mappedData = userList.map((u: any) => ({ assetId: savedAsset._id, userId: u }));
      await createMapUserAssets(mappedData);
    }
    return savedAsset._id;
  } catch (error) {
    console.error("Error in make Asset Copy:", error);
    throw error;
  }
};

const getAssetEndPoints = async (asset_id: string[], token: string, user_id: any) => {
  const payload: any = { asset_id };
  return await getExternalData(`/getAllEndPoints/`, 'POST', payload, token, `${user_id}`);
}

const createEndPointCopy = async (assetsList: any, user_id: any, token: any): Promise<any> => {
  return await getExternalData(`/endPointApi/`, 'POST', assetsList, token, `${user_id}`);
}

export const createExternalAPICall = async (assetsList: any, account_id: any, user_id: any, token: any): Promise<any> => {
  const assetIdList: string[] = assetsList.map((item: any) => `${item.assetId}`);
  const match = { org_id: `${account_id}`, asset_status: "Not Defined", asset_id: assetIdList };
  return await getExternalData(`/asset_health_status/`, 'POST', match, token, `${user_id}`);
}
