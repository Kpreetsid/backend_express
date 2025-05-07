import { User, IUser } from "../../_models/user.model";
import { Request, Response, NextFunction } from 'express';

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