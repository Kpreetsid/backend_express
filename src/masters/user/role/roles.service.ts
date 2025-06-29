import mongoose from "mongoose";
import { UserRoleMenu, IUserRoleMenu } from "../../../models/userRoleMenu.model";
import { Request, Response, NextFunction } from 'express';
import { IUser } from "../../../models/user.model";
import { platformControlData } from '../../../_config/userRoles';
import { get } from "lodash";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const data = await UserRoleMenu.find({});
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getMyRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const data = await UserRoleMenu.findOne({ account_id: account_id, user_id: user_id, visible: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const data = await UserRoleMenu.findById(id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const verifyUserRole = async (id: string, companyID: string) => {
  try {
    const userRole: IUserRoleMenu | null = await UserRoleMenu.findOne({ user_id: new mongoose.Types.ObjectId(id), account_id: new mongoose.Types.ObjectId(companyID) });
    if (!userRole) {
      return null;
    }
    return userRole;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newUserRoleMenu: IUserRoleMenu = new UserRoleMenu(req.body);
    await newUserRoleMenu.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: newUserRoleMenu });
  } catch (error) {
    console.error(error);
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
    const roleData = await newUserRoleMenu.save();
    return roleData;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updatedUserRoleMenu = await UserRoleMenu.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedUserRoleMenu) {
      throw Object.assign(new Error('No data found'), { status: 404 });
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
    const data = await UserRoleMenu.findById(id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await UserRoleMenu.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};