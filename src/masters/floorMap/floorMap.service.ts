import { EndpointLocationModel } from "../../models/floorMap.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../../models/user.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";

export const getFloorMaps = async (match: any) => {
  return await EndpointLocationModel.find(match);
};

export const getCoordinates = async (match: any, account_id: any): Promise<any> => {
  const floorMaps = await EndpointLocationModel.find(match).populate([{ path: 'locationId', model: "Schema_Location", select: 'location_name' }]);
  if (!floorMaps || floorMaps.length === 0) {
    throw Object.assign(new Error('No coordinates found for the given location'), { status: 404 });
  }
  return await Promise.all(
    floorMaps.map(async (item: any) => {
      const childLocations = await getAllChildLocationsRecursive([`${item.locationId._id}`]);
      const finalLocIds = [item.locationId, ...childLocations];
      const assetsMatch: any = { locationId: { $in: finalLocIds }, visible: true, account_id, asset_type: { $nin: ['Flexible', 'Rigid', 'Belt_Pulley'] } };
      const assetList = await AssetModel.find(assetsMatch).select('asset_name asset_type');
      return { item, assetList };
    })
  );
};

export const getAllChildLocationsRecursive = async (parentIds: any): Promise<any> => {
  let childIds: string[] = [];
  for (const parentId of parentIds) {
    const parent = await LocationModel.findById(parentId);
    if (!parent) continue;
    const match = { parent_id: parent._id, visible: true };
    const children = await LocationModel.find(match);
    if (children?.length > 0) {
      const childrenIds = children.map((child: any) => child._id.toString());
      childIds.push(...childrenIds);
      const grandChildren = await getAllChildLocationsRecursive(childrenIds);
      childIds.push(...grandChildren);
    }
  }
  return childIds;
}

export const floorMapAssetCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const location_id = req.params.id || req.query.locationId;
    const match: any = { account_id };
    if (userRole !== "admin") {
      match.user_id = user_id;
    }
    if (location_id) {
      match.data_type = "asset";
      match.locationId = location_id.toString(); // make sure it's string
    }
    const floorMaps = await EndpointLocationModel.find(match);
    if (!floorMaps || floorMaps.length === 0) {
      throw Object.assign(new Error("No coordinates found for the given location"), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Coordinates Found", data: floorMaps });
  } catch (error) {
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const endpointLocation = new EndpointLocationModel(req.body);
    await endpointLocation.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: endpointLocation });
  } catch (error) {
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { body: { name, description, location }, params: { id } } = req;
    const data = await EndpointLocationModel.findByIdAndUpdate(id, { name, description, location }, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const removeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await EndpointLocationModel.findById(req.params.id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await EndpointLocationModel.findByIdAndUpdate(req.params.id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const insertCoordinates = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    const newMappedCoordinates = new EndpointLocationModel({
      "coordinate": body.coordinate,
      "locationId": body.locationId,
      "account_id": account_id,
      "data_type": body.data_type,
      "createdBy": user_id
    });
    if (body.data_type === 'asset') {
      newMappedCoordinates.end_point_id = body.end_point_id;
      newMappedCoordinates.end_point = body.end_point;
    }
    const data = await newMappedCoordinates.save();
    if (!data) {
      throw Object.assign(new Error('Failed to set coordinates'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Coordinates added successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteCoordinates = async (match: any) => {
  return await EndpointLocationModel.findOneAndDelete(match);
};