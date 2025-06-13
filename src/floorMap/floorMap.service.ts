import { EndpointLocation } from "../models/floorMap.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../models/user.model";
import { getData } from "../util/queryBuilder";
import { LocationMaster } from "../models/location.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
     const match = { account_id: account_id, isActive: true };
    const data = await getData(EndpointLocation, { filter: match });
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const floorMapCoordinates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const match: any = { };
    const { location_id } = req.query;
    if (location_id) {
      const childLocations = await getAllChildLocationsRecursive([location_id]);
      match.locationId = { $in: [location_id, ...childLocations] };
      match.data_type = "location";
    } else {
      match.account_id = account_id;
      match.data_type = "kpi";
    }
    const data = await getData(EndpointLocation, { filter: match, populate: 'locationId' });
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

const getAllChildLocationsRecursive = async (parentIds: any) => {
  try {
    let childIds: any = [];
    for (let i = 0; i < parentIds.length; i++) {
      const parent: any = await LocationMaster.findById(parentIds[i]);
      const children = await LocationMaster.find({
        where: {
          parent_id: parent.id,
          visible: true
        }
      });
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

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const data = await EndpointLocation.findById(id);
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
    const endpointLocation = new EndpointLocation(req.body);
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
    const data = await EndpointLocation.findByIdAndUpdate(id, { name, description, location }, { new: true });
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
    const data = await EndpointLocation.findById(id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await EndpointLocation.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};