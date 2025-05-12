import { User, IUser, UserLoginPayload } from "../../_models/user.model";
import { MapUserLocation } from "../../_models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import mongoose from "mongoose";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await User.find({}).select('-password').sort({ _id: -1 });
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
    const id = req.params.id;
    const data = await User.findById(id).select('-password');
    if (!data) {
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

export const verifyUserLogin = async ({ id, companyID, email, username }: UserLoginPayload) => {
  try {
    const user: IUser | null = await User.findOne({ _id: id, account_id: companyID, email, username }).select('-password');
    return user;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const getLocationWiseUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { location_id } = req.body;
    if(req.user.user_role !== "admin") {
      const error = new Error("Unauthorize data access request");
      (error as any).status = 401;
      throw error;
    }
    const data = await MapUserLocation.find({ locationId: new mongoose.Types.ObjectId(location_id) }).select('userId -_id');
    if (data.length === 0) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    const userIDList = data.map(doc => doc.userId);
    const userData = await User.find({ _id: { $in: userIDList }}).select('-password');
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: userData });;
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = new User(req.body);
    await user.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: user });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const { name, email, password, role } = req.body;
    const data = await User.findByIdAndUpdate(id, { name, email, password, role }, { new: true });
    if (!data) {
      const error = new Error("No data found");
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
    const id = req.params.id;
    const data = await User.findByIdAndDelete(id);
    if (!data) {
      const error = new Error("No data found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data deleted successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};