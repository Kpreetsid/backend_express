import { UserModel, IUser, UserLoginPayload } from "../../models/user.model";
import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import mongoose from "mongoose";
import { hashPassword } from '../../_config/bcrypt';
import { createUserRole } from './role/roles.service';
import { get } from "lodash";

export const getAllUsers = async (match: any) => {
  return await UserModel.find(match).select('-password');
};

export const getUserDetails = async (match: any) => {
  return await UserModel.findOne(match).select('+password');
};

export const verifyUserLogin = async ({ id, companyID, username }: UserLoginPayload) => {
  return await UserModel.findOne({ _id: id, account_id: companyID, username: username }).select('-password');
};

export const userVerified = async (id: string) => {
  return await UserModel.findOneAndUpdate({ _id: id }, { isVerified: true }, { new: true });
};

export const getLocationWiseUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { locationID } = req.params;
    const { user_role: userRole } = get(req, "user", {}) as IUser;
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const data = await MapUserAssetLocationModel.find({ locationId: new mongoose.Types.ObjectId(locationID) }).select('userId -_id');
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const userIDList = data.map((doc: any) => doc.userId);
    const userData = await UserModel.find({ _id: { $in: userIDList } }).select('-password');
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: userData });;
  } catch (error) {
    next(error);
  }
};

export const createNewUser = async (body: IUser, account_id: any) => {
  body.password = await hashPassword(body.password);
  const newUser = new UserModel({ ...body, account_id });
  const userDetails = await newUser.save();
  const roleDetails = await createUserRole(body.user_role, userDetails);
  return { userDetails, roleDetails };
};

export const updateUserPassword = async (user_id: any, body: any) => {
  body.password = await hashPassword(body.password);
  return await UserModel.findByIdAndUpdate(user_id, body, { new: true });
};

export const updateUserDetails = async (id: string, body: IUser) => {
  return await UserModel.findByIdAndUpdate(id, body, { new: true });
}

export const removeById = async (id: string) => {
  await MapUserAssetLocationModel.deleteMany({ userId: id });
  return await UserModel.findByIdAndUpdate(id, { visible: false, user_status: 'inactive' }, { new: true });
};