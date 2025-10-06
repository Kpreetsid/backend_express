import { LocationModel, ILocationMaster } from "../../models/location.model";
import { IMapUserLocation, MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { AssetModel } from "../../models/asset.model";
import mongoose from "mongoose";
import { getLocationsMappedData } from "../../transaction/mapUserLocation/userLocation.service";
import { getData } from "../../util/queryBuilder";

export const getAllLocations = async (match: any) => {
  const locationData = await LocationModel.find(match).populate([{ path: 'parent_id', model: "Schema_Location", select: 'id location_name' }]);
  const locationIds = locationData.map(doc => `${doc._id}`);
  const mapData = await MapUserAssetLocationModel.find({ locationId: { $in: locationIds }, userId: { $exists: true } }).populate([{ path: 'userId', model: "Schema_User", select: 'id firstName lastName user_role' }]);
  const result: any = locationData.map((doc: any) => {
    const { _id: id, ...obj } = doc.toObject();
    obj.id = id;
    const mappedUser = mapData.filter(map => `${map.locationId}` === `${id}`);
    obj.userList = mappedUser.length > 0 ? mappedUser.map((a: any) => a.userId).filter((user: any) => user) : [];
    return obj;
  });
  return result;
};

const buildLocationTree = async (parentId: string | null, account_id: any, allowedLocationIds: string[], userRole: string): Promise<any[]> => {
  const match: any = { account_id, visible: true, parent_id: parentId ? parentId : { $exists: false } };
  const nodes = await getData(LocationModel, { filter: match });
  return Promise.all(
    nodes.map(async (node: any) => {
      if (userRole !== "admin" && !allowedLocationIds.includes(node._id.toString())) {
        return null;
      }
      const children = await buildLocationTree(node._id.toString(), account_id, allowedLocationIds, userRole);
      return { ...node, childs: children.filter(Boolean) };
    })
  ).then(results => results.filter(Boolean));
};

export const getAllChildLocationIds = async (locationId: string): Promise<string[]> => {
  const children = await LocationModel.find({ parent_id: locationId, visible: true }).select('_id');
  if (!children || children.length === 0) {
    return [locationId];
  }
  const allChildIds: string[] = [];
  for (const child of children) {
    const subChildIds = await getAllChildLocationIds(`${child._id}`);
    allChildIds.push(...subChildIds);
  }
  return [locationId, ...allChildIds];
};

export const getTree = async (match: any, location_id: any, allowedLocationIds: string[], userRole: string): Promise<any> => {
  const rootLocations: ILocationMaster[] = await getData(LocationModel, { filter: match });
  if (!rootLocations?.length) {
    throw Object.assign(new Error("No data found"), { status: 404 });
  }
  let treeData: any[];
  if (location_id) {
    const parentNode = rootLocations[0];
    if (userRole !== "admin" && !allowedLocationIds.includes(`${parentNode._id}`)) {
      throw Object.assign(new Error("No access to this location"), { status: 403 });
    }
    const children = await buildLocationTree(parentNode.id, match.account_id, allowedLocationIds, userRole);
    treeData = [{ ...parentNode, childs: children }];
  } else {
    treeData = await Promise.all(
      rootLocations.map(async (node: any) => {
        if (userRole !== "admin" && !allowedLocationIds.includes(node._id.toString())) {
          return null;
        }
        const children = await buildLocationTree(node.id, match.account_id, allowedLocationIds, userRole);
        return { ...node, childs: children };
      })
    ).then(results => results.filter(Boolean));
  }
  return treeData;
};

export const kpiFilterLocations = async (account_id: any, user_id: any, userRole: string) => {
  try {
    const match: any = { account_id, visible: true };
    if (userRole !== "admin") {
      const mapLocationData: IMapUserLocation[] = await getLocationsMappedData(user_id);
      if (!mapLocationData?.length) {
        throw Object.assign(new Error('No location mapping found for user'), { status: 404 });
      }
      const locationIds = mapLocationData.map((doc) => doc.locationId?.toString()).filter(Boolean);
      if (!locationIds.length) {
        throw Object.assign(new Error('No valid location IDs found'), { status: 404 });
      }
      match._id = { $in: locationIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
    const locations: any = await LocationModel.find(match).lean();
    if (!locations?.length) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }
    const idMap: Record<string, any> = {};
    locations.forEach((loc) => {
      idMap[`${loc._id}`] = { ...loc, children: [] };
    });
    const rootNodes: any[] = [];
    locations.forEach((loc) => {
      const parentId = loc.parent_id ? loc.parent_id.toString() : null;
      if (parentId && idMap[parentId]) {
        idMap[parentId].children.push(idMap[`${loc._id}`]);
      } else {
        rootNodes.push(idMap[`${loc._id}`]);
      }
    });
    const levelOneLocations: any[] = [];
    const levelTwoLocations: any[] = [];
    const levelThreeLocations: any[] = [];
    const traverse = (nodes: any[], level: number) => {
      for (const node of nodes) {
        const formatted = {
          location_name: node.location_name,
          id: node._id.toString(),
        };
        if (level === 1) levelOneLocations.push(formatted);
        else if (level === 2) levelTwoLocations.push(formatted);
        else if (level === 3) levelThreeLocations.push(formatted);
        if (node.children?.length) {
          traverse(node.children, level + 1);
        }
      }
    };
    traverse(rootNodes, 1);
    return { levelOneLocations, levelTwoLocations, levelThreeLocations };
  } catch (error) {
    return null;
  }
};

export const childAssetsAgainstLocation = async (lOne: any, lTwo: any, account_id: any) => {
  try {
    const childIds = await getAllChildLocationsRecursive(lTwo);
    const finalList = [...childIds, ...lOne, ...lTwo]
    const data: any = await AssetModel.find({ locationId: { $in: finalList }, top_level: true, account_id, visible: true }).select('id top_level asset_name asset_type');
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return { assetList: data, locationList: finalList };
  } catch (error) {
    return null;
  }
}

const getAllChildLocationsRecursive = async (parentIds: any) => {
  try {
    let childIds: any = [];
    for (let i = 0; i < parentIds.length; i++) {
      const parent: any = await LocationModel.findById(parentIds[i]);
      const children = await LocationModel.find({ where: { parent_id: parent.id, visible: true } });
      if (children.length > 0) {
        const childrenIds = children.map(child => child.id);
        childIds = [...childIds, ...childrenIds];
        const grandChildrenIds = await getAllChildLocationsRecursive(childrenIds);
        childIds = [...childIds, ...grandChildrenIds];
      }
    }
    return childIds;
  } catch (error) {
    return [];
  }
}

export const insertLocation = async (body: any) => {
  const newLocation = new LocationModel(body);
  newLocation.top_level_location_id = body.top_level_location_id || newLocation._id as mongoose.Types.ObjectId;
  body.parent_id = body.top_level_location_id || newLocation._id as mongoose.Types.ObjectId;
  return await newLocation.save();
};

export const updateById = async (id: string, body: any) => {
  await MapUserAssetLocationModel.deleteMany({ locationId: id });
  await LocationModel.updateOne({ _id: id }, body);
  return await LocationModel.findById(id);
};

export const removeById = async (id: string, data: any, user_id: any) => {
  const promiseList: any = [];
  const totalIds = [id];
  if (data.top_level) {
    const childIds = await getAllChildLocationsRecursive([id]);
    totalIds.push(...childIds);
    promiseList.push(LocationModel.updateMany({ _id: { $in: childIds } }, { visible: false, updatedBy: user_id }));
  }
  promiseList.push(AssetModel.updateMany({ locationId: { $in: totalIds } }, { visible: false, updatedBy: user_id }));
  promiseList.push(LocationModel.updateMany({ _id: { $in: totalIds } }, { visible: false, updatedBy: user_id }));
  await Promise.all(promiseList);
  return true;
};

export const updateFloorMapImage = async (id: string, account_id: any, user_id: any, top_level_location_image: string) => {
  return await LocationModel.updateOne({ _id: id, account_id }, { $set: { top_level_location_image, updatedBy: user_id } });
};

export const getLocationSensor = async (account_id: any, user_id: any, userRole: string) => {
  try {
    const match: any = { account_id, visible: true };
    if (userRole !== 'admin') {
      const mappedData = await getLocationsMappedData(`${user_id}`);
      if (!mappedData || mappedData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mappedData.map(doc => doc.locationId) };
    }
    const data = await LocationModel.find(match).populate([{ path: 'account_id', model: "Schema_Account", select: 'id account_name' }, { path: 'top_level_location_id', model: "Schema_Location", select: 'id location_name' }]);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const result = data.map((doc: any) => {
      return {
        company_name: doc.account_id ? doc.account_id.account_name : "NA",
        location_id: doc._id,
        location_name: doc.location_name,
        top_level_location_id: doc.top_level_location_id ? doc.top_level_location_id._id : "",
        top_level_location_name: doc.top_level_location_id ? doc.top_level_location_id.location_name : "NA"
      }
    });
    return result;
  } catch (error) {
    return null;
  }
}