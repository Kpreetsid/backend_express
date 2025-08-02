import mongoose from "mongoose";
import { UserRoleMenu, IUserRoleMenu } from "../../../models/userRoleMenu.model";
import { Request, Response, NextFunction } from 'express';
import { IUser } from "../../../models/user.model";
import { platformControlData } from '../../../_config/userRoles';

export const getRoles = async (match: any): Promise<any> => {
  return await UserRoleMenu.find(match);
};

export const verifyUserRole = async (id: string, companyID: string) => {
  try {
    const userRole: IUserRoleMenu | null = await UserRoleMenu.findOne({ user_id: new mongoose.Types.ObjectId(id), account_id: new mongoose.Types.ObjectId(companyID) });
    if (!userRole) {
      return null;
    }
    return userRole;
  } catch (error) {
    return null;
  }
}

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const newUserRoleMenu: IUserRoleMenu = new UserRoleMenu(req.body);
    await newUserRoleMenu.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: newUserRoleMenu });
  } catch (error) {
    next(error);
  }
};

export const createUserRole = async (userRole: any, userData: IUser) => {
  try {
    var platformControl =  await platformControlData(userRole);
    const newUserRoleMenu: IUserRoleMenu = new UserRoleMenu({
      user_id: userData._id,
      account_id: userData.account_id,
      data: platformControl
    });
    return await newUserRoleMenu.save();
  } catch (error) {
    return null;
  }
}

export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const updatedUserRoleMenu = await UserRoleMenu.findByIdAndUpdate(id, body, { new: true });
    if (!updatedUserRoleMenu) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data: updatedUserRoleMenu });
  } catch (error) {
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await UserRoleMenu.findById(req.params.id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await UserRoleMenu.findByIdAndUpdate(req.params.id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};