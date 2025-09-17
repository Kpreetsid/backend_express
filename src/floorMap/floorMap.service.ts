import { EndpointLocationModel } from "../models/floorMap.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../models/user.model";
import { getData } from "../util/queryBuilder";
import { LocationModel } from "../models/location.model";
import { AssetModel } from "../models/asset.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match = { account_id: account_id, isActive: true };
    const data = await getData(EndpointLocationModel, { filter: match });
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { location_id } = req.query;
    let match: any = {};
    if (location_id) {
      const childLocations = await getAllChildLocationsRecursive([location_id]);
      match = { locationId: { $in: [location_id, ...childLocations] }, data_type: 'location' };
    } else {
      match = { account_id, data_type: 'kpi' };
    }

    const floorMaps = await getData(EndpointLocationModel, { filter: match, populate: 'locationId' });
    if (!floorMaps || floorMaps.length === 0) {
      throw Object.assign(new Error('No coordinates found for the given location'), { status: 404 });
    }
    const enrichedFloorMaps = await Promise.all(
      floorMaps.map(async (item: any) => {
        item.location = { id: item.locationId._id, location_name: item.locationId.location_name };
        item.locationId = item.locationId._id;
        const childLocations = await getAllChildLocationsRecursive([item.locationId]);
        const finalLocIds = [item.locationId, ...childLocations];
        const assetsMatch: any = { locationId: { $in: finalLocIds }, visible: true, account_id };
        const assetList = await getData(AssetModel, { filter: assetsMatch, select: 'asset_name asset_type' });
        return { item, assetList };
      })
    );
    if (!enrichedFloorMaps.length) {
      throw Object.assign(new Error('No assets found for the given location'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: 'Coordinates Found', data: enrichedFloorMaps });
  } catch (err) {
    console.error('Error in getCoordinateByAccId:', err);
    next(err);
  }
};

export const floorMapAssetCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id: location_id } = req.params;
    let match: any = { account_id: account_id };
    if (location_id) {
      match.data_type = 'asset';
      match.locationId = location_id;
    }
    const floorMaps = await getData(EndpointLocationModel, { filter: match });
    if (!floorMaps || floorMaps.length === 0) {
      throw Object.assign(new Error('No coordinates found for the given location'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: 'Coordinates Found', data: floorMaps });
  } catch (err) {
    console.error('Error in getCoordinateByAccId:', err);
    next(err);
  }
};

const getAllChildLocationsRecursive = async (parentIds: any): Promise<any> => {
  let childIds: string[] = [];
  for (const parentId of parentIds) {
    const parent = await LocationModel.findById(parentId);
    if (!parent) continue;
    const match = { parent_id: parent._id, visible: true };
    const children = await getData(LocationModel, { filter: match });
    if (children?.length > 0) {
      const childrenIds = children.map((child: any) => child._id.toString());
      childIds.push(...childrenIds);
      const grandChildren = await getAllChildLocationsRecursive(childrenIds);
      childIds.push(...grandChildren);
    }
  }
  return childIds;
}

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const data = await EndpointLocationModel.findById(id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const endpointLocation = new EndpointLocationModel(req.body);
    await endpointLocation.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: endpointLocation });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { name, description, location } = req.body;
    const data = await EndpointLocationModel.findByIdAndUpdate(id, { name, description, location }, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const data = await EndpointLocationModel.findById(id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await EndpointLocationModel.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};