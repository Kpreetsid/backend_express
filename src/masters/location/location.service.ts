import { LocationModel, ILocationMaster } from "../../models/location.model";
import { IMapUserLocation, MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { AssetModel } from "../../models/asset.model";
import { WorkOrderModel } from "../../models/workOrder.model";
import { ObservationModel } from "../../models/observation.model";
import { PartsModel } from "../../models/part.model";
import { WorkRequestModel } from "../../models/workRequest.model";
import { InspectionModel } from "../../models/inspection.model";
import { SOPsModel } from "../../models/sops.model";
import { SchedulerModel } from "../../models/scheduleMaster.model";
import { helperService } from "../../utils/helper";
import mongoose from "mongoose";
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { mapUserToAssetService, updateLocationAssetMapping } from '../../transaction/mapUserAsset/userAsset.service';
import { getData } from "../../utils/queryBuilder";

class LocationService {

  async getLocationsList(match: any) {
    return await LocationModel.find(match).lean();
  };

  async getAllLocations(match: any) {
    const locationData = await LocationModel.find(match).populate([{ path: 'parent_id', model: "Schema_Location", select: 'id location_name', match: { visible: true } }]);
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

  async buildLocationTree(parentId: string | null, account_id: any, allowedLocationIds: string[], userRole: string): Promise<any[]> {
    const match: any = { account_id, visible: true, parent_id: parentId ? parentId : { $exists: false } };
    const nodes = await getData(LocationModel, { filter: match });
    return Promise.all(
      nodes.map(async (node: any) => {
        if (userRole !== "admin" && !allowedLocationIds.includes(node._id.toString())) {
          return null;
        }
        const children = await this.buildLocationTree(node._id.toString(), account_id, allowedLocationIds, userRole);
        return { ...node, childs: children.filter(Boolean) };
      })
    ).then(results => results.filter(Boolean));
  };

  async getAllChildLocationIds(locationId: string): Promise<string[]> {
    const children = await LocationModel.find({ parent_id: locationId, visible: true }).lean();
    if (!children || children.length === 0) {
      return [locationId];
    }
    const allChildIds: string[] = [];
    for (const child of children) {
      const subChildIds = await this.getAllChildLocationIds(`${child._id}`);
      allChildIds.push(...subChildIds);
    }
    return [locationId, ...allChildIds];
  };

  async getTree(match: any, location_id: any, allowedLocationIds: string[], userRole: string): Promise<any> {
    const rootLocations: ILocationMaster[] = await getData(LocationModel, { filter: match });
    if (!rootLocations?.length) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }
    let treeData: any[];
    if (location_id) {
      const parentNode: any = rootLocations[0];
      if (userRole !== "admin" && !allowedLocationIds.includes(`${parentNode._id}`)) {
        throw Object.assign(new Error("No access to this location"), { status: 403 });
      }
      const children = await this.buildLocationTree(parentNode.id, match.account_id, allowedLocationIds, userRole);
      treeData = [{ ...parentNode, childs: children }];
    } else {
      treeData = await Promise.all(
        rootLocations.map(async (node: any) => {
          if (userRole !== "admin" && !allowedLocationIds.includes(node._id.toString())) {
            return null;
          }
          const children = await this.buildLocationTree(node.id, match.account_id, allowedLocationIds, userRole);
          return { ...node, childs: children };
        })
      ).then(results => results.filter(Boolean));
    }
    return treeData;
  };

  async kpiFilterLocations(account_id: any, user_id: any, userRole: string) {
    try {
      const match: any = { account_id, visible: true };
      if (userRole !== "admin") {
        const mapLocationData: IMapUserLocation[] = await mapUserToLocationService.getLocationsMappedData(user_id);
        if (!mapLocationData?.length) {
          throw Object.assign(new Error('No location mapping found for user'), { status: 404 });
        }
        const locationIds = mapLocationData.map((doc) => doc.locationId?.toString()).filter(Boolean);
        if (!locationIds.length) {
          throw Object.assign(new Error('No valid location IDs found'), { status: 404 });
        }
        match._id = { $in: helperService.validateObjectIds(locationIds.join(',')) };
      }
      const locations: any = await LocationModel.find(match).lean();
      if (!locations?.length) {
        throw Object.assign(new Error("No data found"), { status: 404 });
      }
      const idMap: Record<string, any> = {};
      locations.forEach((loc: any) => {
        idMap[`${loc._id}`] = { ...loc, children: [] };
      });
      const rootNodes: any[] = [];
      locations.forEach((loc: any) => {
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

  async childAssetsAgainstLocation(lOne: string[], lTwo: string[], account_id: any, user_id: any, userRole: string) {
    try {
      const childIds = await this.getAllChildLocationsRecursive(lTwo);
      const finalList = [...new Set([...childIds, ...lOne, ...lTwo])];
      const assetMatch: any = { account_id, visible: true };
      const locationObjectIds = helperService.validateObjectIds(finalList.join(','));
      if (locationObjectIds?.length > 0) {
        assetMatch.locationId = { $in: locationObjectIds };
      }
      if (userRole !== "admin") {
        const mappedAssetList: any = await mapUserToAssetService.getAssetsMappedData(user_id);
        if (mappedAssetList && mappedAssetList.length > 0) {
          assetMatch._id = { $in: mappedAssetList.map((doc: any) => doc.assetId) };
        }
      }
      const data: any = await AssetModel.find(assetMatch).select('id top_level asset_name asset_type asset_build_type');
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const locationData = await LocationModel.aggregate([
        { $match: { _id: { $in: locationObjectIds }, visible: true } },
        { $project: { location_name: 1, _id: 1 } },
        { $addFields: { id: { $toString: '$_id' }, name: '$location_name' } }
      ]);
      if (!locationData || locationData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      return { assetList: data, locationList: locationData };
    } catch (error) {
      console.error('Error in childAssetsAgainstLocation:', error);
      return null;
    }
  };

  async getAllChildLocationsRecursive(parentIds: string[]): Promise<string[]> {
    try {
      let childIds: string[] = [];
      for (const parentId of parentIds) {
        const parent = await LocationModel.findById(parentId);
        if (!parent) continue;
        const children: ILocationMaster[] = await LocationModel.find({ parent_id: parent._id, visible: true });
        if (children.length > 0) {
          const childrenIds = children.map(child => (child._id as mongoose.Types.ObjectId).toString());
          childIds = [...childIds, ...childrenIds];
          const grandChildrenIds = await this.getAllChildLocationsRecursive(childrenIds);
          childIds = [...childIds, ...grandChildrenIds];
        }
      }
      return [...new Set([...parentIds, ...childIds])];
    } catch (error) {
      console.error('Error in getAllChildLocationsRecursive:', error);
      return [];
    }
  }

  async insertLocation(body: any) {
    const newLocation: any = new LocationModel(body);
    newLocation.top_level_location_id = newLocation.top_level ? newLocation._id as mongoose.Types.ObjectId : body.top_level_location_id;
    body.parent_id = body.top_level_location_id || newLocation._id as mongoose.Types.ObjectId;
    return await newLocation.save();
  };

  async updateById(id: string, body: any) {
    // await mapUserToLocationService.updateUserMapping(id, body.userIdList);
    await updateLocationAssetMapping(id, body.userIdList);
    await LocationModel.updateOne({ _id: id }, body);
    return await LocationModel.findById(id);
  };

  async removeLocationById(id: any, user_id: any) {
    const totalIds = [id];
    const childIds = await this.getAllChildLocationsRecursive([id]);
    totalIds.push(...childIds);
    const objectIds = helperService.validateObjectIds(totalIds.join(','));
    await mapUserToLocationService.removeLocationListMapping(totalIds);
    const getAssetsByLocationId = await AssetModel.find({ locationId: { $in: objectIds } });
    if (getAssetsByLocationId?.length > 0) {
      const assetIds: any = getAssetsByLocationId.map(asset => asset._id);
      await mapUserToAssetService.removeAssetListMapping(assetIds);
    }
    const updateQuery = { $set: { visible: false, updatedBy: user_id } };
    await AssetModel.updateMany({ locationId: { $in: objectIds } }, updateQuery);
    await WorkOrderModel.updateMany({ wo_location_id: { $in: objectIds } }, updateQuery);
    await ObservationModel.updateMany({ locationId: { $in: objectIds } }, updateQuery);
    await PartsModel.updateMany({ location_id: { $in: objectIds } }, updateQuery);
    await WorkRequestModel.updateMany({ location_id: { $in: objectIds } }, updateQuery);
    await InspectionModel.updateMany({ location_id: { $in: objectIds } }, updateQuery);
    await SOPsModel.updateMany({ locationId: { $in: objectIds } }, updateQuery);
    await SchedulerModel.updateMany({ "work_order.wo_location_id": { $in: objectIds } }, updateQuery);
    await LocationModel.updateMany({ _id: { $in: objectIds } }, updateQuery);
    return true;
  };

  async updateFloorMapImage(id: string, account_id: any, user_id: any, top_level_location_image: string) {
    return await LocationModel.updateOne({ _id: id, account_id }, { $set: { top_level_location_image, updatedBy: user_id } });
  };

  async getLocationSensor(account_id: any, user_id: any, userRole: string) {
    try {
      const match: any = { account_id, visible: true };
      if (userRole !== 'admin') {
        const mappedData = await mapUserToLocationService.getLocationsMappedData(`${user_id}`);
        if (!mappedData || mappedData.length === 0) {
          throw Object.assign(new Error('No data found'), { status: 404 });
        }
        match._id = { $in: mappedData.map(doc => doc.locationId) };
      }
      const data = await LocationModel.find(match).populate([{ path: 'account_id', model: "Schema_Account", select: 'id account_name' }, { path: 'top_level_location_id', model: "Schema_Location", select: 'id location_name', match: { visible: true } }]);
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

  getLocationById(id: any, account_id: any) {
    return LocationModel.findOne({ _id: id, account_id, visible: true });
  };

  async getAllChildHierarchy(parentId: any, account_id: any): Promise<any[]> {
    const children = await LocationModel.find({ parent_id: parentId, account_id, visible: true }).lean();
    const all: any[] = [];
    for (const child of children) {
      all.push(child);
      const subChildren = await this.getAllChildHierarchy(child._id.toString(), account_id);
      all.push(...subChildren);
    }
    return all;
  };

  async cloneLocationNode(source: any, user_id: any, account_id: any, newParentId?: any, idMap?: any, newTopLevelId?: any): Promise<any> {
    const userMappings = await mapUserToLocationService.getDataByLocationId(source._id.toString());
    const userList = userMappings.map((u: any) => u.userId);
    const { _id, id, createdAt, updatedAt, ...rest } = source;
    const cleanSource = JSON.parse(JSON.stringify(rest));
    delete cleanSource._id;
    delete cleanSource.id;
    const baseName = (source.location_name || "Location").replace(/\s-\s(copy|\(\d+\))$/i, "");
    const existingCount = await LocationModel.countDocuments({
      parent_id: newParentId || { $exists: false },
      account_id,
      location_name: { $regex: `^${baseName} - copy`, $options: "i" },
      visible: true,
    });
    const newName = existingCount > 0 ? `${baseName} - copy (${existingCount + 1})` : `${baseName} - copy`;
    let topLevelRef: any = null;
    if (source.top_level) {
      topLevelRef = undefined;
    } else if (newTopLevelId) {
      topLevelRef = newTopLevelId;
    } else if (source.top_level_location_id) {
      topLevelRef = source.top_level_location_id;
    }
    const newBody: any = {
      ...cleanSource,
      location_name: newName,
      parent_id: newParentId ? helperService.validateObjectId(String(newParentId)) : undefined,
      account_id,
      createdBy: user_id,
      updatedBy: undefined,
      visible: true,
      top_level: source.top_level,
      top_level_location_id: topLevelRef,
    };
    const newLoc = new LocationModel(newBody);
    await newLoc.save();
    if (source.top_level) {
      newLoc.top_level_location_id = newLoc._id;
      await newLoc.save();
    }
    if (userList.length > 0) {
      await mapUserToLocationService.mapUserLocationData(newLoc._id, userList, account_id);
    }
    return newLoc._id;
  };
}

export const locationService = new LocationService();