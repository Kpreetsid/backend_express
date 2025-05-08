import mongoose from "mongoose";
import { LocationMaster, ILocationMaster } from "../../_models/location.model";
import { Request, Response, NextFunction } from 'express';
const moduleName: string = "location";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const data: ILocationMaster[] = await LocationMaster.find({ account_id: new mongoose.Types.ObjectId(user.account_id) }).sort({ _id: -1 });
    if (data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
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
    const data: ILocationMaster | null = await LocationMaster.findByIdAndDelete(id);
    if (!data) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};