import mongoose from "mongoose";
import { RoleMenuModel, IUserRoleMenu } from "../../../models/userRoleMenu.model";
import { Request, Response, NextFunction } from 'express';
import { IUser } from "../../../models/user.model";
import { platformControlData } from '../../../_config/userRoles';
import { roleMenuData } from "../../../_config/newUserRoles";

export const getRoles = async (match: any): Promise<any> => {
  return await RoleMenuModel.find(match);
};

export const verifyUserRole = async (id: string, companyID: string) => {
  try {
    const userRole: IUserRoleMenu | null = await RoleMenuModel.findOne({ user_id: new mongoose.Types.ObjectId(id), account_id: new mongoose.Types.ObjectId(companyID) });
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
    const newUserRoleMenu: IUserRoleMenu = new RoleMenuModel(req.body);
    await newUserRoleMenu.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: newUserRoleMenu });
  } catch (error) {
    next(error);
  }
};

export const createUserRole = async (userRole: any, userData: IUser, user_id: any) => {
  try {
    var platformControl =  await platformControlData(userRole);
    var newRoleMenu = await roleMenuData(userRole);
    const newUserRoleMenu: IUserRoleMenu = new RoleMenuModel({
      user_id: userData._id,
      account_id: userData.account_id,
      data: platformControl,
      roleMenu: newRoleMenu,
      createdBy: user_id
    });
    const data = await newUserRoleMenu.save();
    if (!data) {
      return null;
    }
    return data;
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
    const updatedUserRoleMenu = await RoleMenuModel.findByIdAndUpdate(id, body, { new: true });
    if (!updatedUserRoleMenu) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data: updatedUserRoleMenu });
  } catch (error) {
    next(error);
  }
};

export const removeById = async (id: any, user_id: any): Promise<any> => {
  return await RoleMenuModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
};