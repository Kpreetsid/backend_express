import { UserRoleMenu, IUserRoleMenu } from "../../../_models/userRoleMenu.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await UserRoleMenu.find({}).sort({ _id: -1 });
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
    const data = await UserRoleMenu.findById(id);
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
    const { role_id, menu_id } = req.body;
    const newUserRoleMenu: IUserRoleMenu = new UserRoleMenu({ role_id, menu_id });
    await newUserRoleMenu.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: newUserRoleMenu });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role_id, menu_id } = req.body;
    const updatedUserRoleMenu = await UserRoleMenu.findByIdAndUpdate(id, { role_id, menu_id }, { new: true });
    if (!updatedUserRoleMenu) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data: updatedUserRoleMenu });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deletedUserRoleMenu = await UserRoleMenu.findByIdAndDelete(id);
    if (!deletedUserRoleMenu) {
      const error = new Error("Data not found");
      (error as any).status = 404;
      throw error;
    }
    return res.status(200).json({ status: true, message: "Data deleted successfully", data: deletedUserRoleMenu });
  } catch (error) {
    console.error(error);
    next(error);
  }
};