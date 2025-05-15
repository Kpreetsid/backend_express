import mongoose from "mongoose";
import { LocationMaster, ILocationMaster } from "../../_models/location.model";
import { Request, Response, NextFunction } from 'express';
import { IMapUserLocation, MapUserLocation } from "../../_models/mapUserLocation.model";
const moduleName: string = "location";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
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
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
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
    if (!data) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = (req as any).role;
    if (!role[moduleName].add_location) {
      const error = new Error("Unauthorized access");
      (error as any).status = 403;
      throw error;
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
      const error = new Error("Unauthorized access");
      (error as any).status = 403;
      throw error;
    }
    const { id } = req.params;
    const data: ILocationMaster | null = await LocationMaster.findByIdAndUpdate(id, req.body, { new: true });
    if (!data) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
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
      const error = new Error("Unauthorized access");
      (error as any).status = 403;
      throw error;
    }
    const { id } = req.params;
    const data = await LocationMaster.findById(id);
    if (!data) {
        const error = new Error("Data not found");
        (error as any).status = 404;
        throw error;
    }
    if(!data.visible) {
        const error = new Error("Data already deleted");
        (error as any).status = 400;
        throw error;
    }
    await LocationMaster.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};