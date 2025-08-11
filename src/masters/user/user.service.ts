import { User, IUser, UserLoginPayload } from "../../models/user.model";
import { MapUserAssetLocation } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import mongoose from "mongoose";
import { hashPassword } from '../../_config/bcrypt';
import { createUserRole } from './role/roles.service';
import { get } from "lodash";

export const getAllUsers = async (match: any) => {
  return await User.find(match).select('-password');
};

export const getUserDetails = async (match: any) => {
  return await User.findOne(match).select('+password');
};

export const verifyUserLogin = async ({ id, companyID, email, username }: UserLoginPayload) => {
  return await User.findOne({ _id: id, account_id: companyID, email, username }).select('-password');
};

export const getLocationWiseUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { locationID } = req.params;
    const { user_role: userRole } = get(req, "user", {}) as IUser;
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const data = await MapUserAssetLocation.find({ locationId: new mongoose.Types.ObjectId(locationID) }).select('userId -_id');
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const userIDList = data.map((doc: any) => doc.userId);
    const userData = await User.find({ _id: { $in: userIDList }}).select('-password');
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: userData });;
  } catch (error) {
    next(error);
  }
};

export const createNewUser = async (body: IUser) => {
  body.password = await hashPassword(body.password);
  const newUser = new User({ ...body, isActive: true, user_status: 'active', isFirstUser: false, visible: true, isVerified: true });
  const userDetails = await newUser.save();
  const roleDetails = await createUserRole(body.user_role, userDetails);
  return { userDetails, roleDetails };
};

export const updateUserPassword = async (user_id: any, body: any) => {
  body.password = await hashPassword(body.password);
  return await User.findByIdAndUpdate(user_id, body, { new: true });
};

export const updateUserDetails = async (id: string, body: IUser) => {
  return await User.findByIdAndUpdate(id, body, { new: true });
}
export const removeById = async (id: string) => {
  await MapUserAssetLocation.deleteMany({ userId: id });
  return await User.findByIdAndUpdate(id, { visible: false, isActive: false, user_status: 'inactive' }, { new: true });
};