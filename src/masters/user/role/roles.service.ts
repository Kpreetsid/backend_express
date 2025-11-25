import { RoleMenuModel, IUserRoleMenu } from "../../../models/userRoleMenu.model";
import { IUser } from "../../../models/user.model";
import { platformControlData } from '../../../_role/userRoles';
import { roleMenuData } from "../../../_role/newUserRoles";
import mongoose from "mongoose";

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

export const insertRole = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const newUserRoleMenu: IUserRoleMenu = new RoleMenuModel({ ...body, account_id, user_id, createdBy: user_id });
  return await newUserRoleMenu.save();
};

export const createUserRole = async (userRole: any, userData: IUser) => {
  try {
    var platformControl =  await platformControlData(userRole);
    var newRoleMenu = await roleMenuData(userRole);
    const newUserRoleMenu: IUserRoleMenu = new RoleMenuModel({
      account_id: userData.account_id,
      user_id: userData._id,
      data: platformControl,
      roleMenu: newRoleMenu,
      createdBy: userData._id
    });
    return await newUserRoleMenu.save();
  } catch (error) {
    console.error(error);
    return null;
  }
}

export const updateById = async (id: any, body: any, user_id: any): Promise<any> => {
  return await RoleMenuModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
};

export const removeById = async (id: any, user_id: any): Promise<any> => {
  return await RoleMenuModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
};