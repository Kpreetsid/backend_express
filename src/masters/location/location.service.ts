import mongoose from "mongoose";
import { LocationMaster, ILocationMaster } from "../../_models/location.model";
import { Request, Response, NextFunction } from 'express';
import { IMapUserLocation, MapUserLocation } from "../../_models/mapUserLocation.model";
const moduleName: string = "location";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = (req as any).user;
    const data: ILocationMaster[] | null = await LocationMaster.find({account_id: account_id}).sort({ _id: -1 });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getTree = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = (req as any).user;
    const match: any = { visible: true, account_id: account_id };
    const mapLocationData: IMapUserLocation[] = await MapUserLocation.find({ userId: user_id });
    if (mapLocationData?.length > 0) {
      const locationIds = mapLocationData.map(doc => doc.locationId).filter(id => id);
      match._id = { $in: locationIds };
    }

    const data: ILocationMaster[] = await LocationMaster.find(match).sort({ _id: -1 });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const locations = data.map(doc => doc.toObject());
    const idMap: { [key: string]: any } = {};
    locations.forEach(loc => {
      idMap[loc._id.toString()] = { ...loc, children: [] };
    });

    const rootNodes: any[] = [];
    locations.forEach(loc => {
      const parentId = loc.parent_id?.toString();
      if (parentId && idMap[parentId]) {
        idMap[parentId].children.push(idMap[loc._id.toString()]);
      } else {
        rootNodes.push(idMap[loc._id.toString()]);
      }
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: rootNodes });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data: ILocationMaster | null = await LocationMaster.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataByFilter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = (req as any).user;
    const body = req.body;
    const match: any = { account_id, user_id };
    if(body.locationId) {
      match._id = body.locationId;
    }
    const data: ILocationMaster[] | null = await LocationMaster.find(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = (req as any).role;
    if (!role[moduleName].add_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const newLocation = new LocationMaster(req.body);
    const data: ILocationMaster = await newLocation.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = (req as any).role;
    if (!role[moduleName].edit_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const { id } = req.params;
    const data: ILocationMaster | null = await LocationMaster.findByIdAndUpdate(id, req.body, { new: true });
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = (req as any).role;
    if (!role[moduleName].delete_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const { id } = req.params;
    const data = await LocationMaster.findById(id);
    if (!data || !data.visible) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await LocationMaster.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};