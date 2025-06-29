import { User, IUser, UserLoginPayload } from "../../models/user.model";
import { MapUserAssetLocation } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import mongoose from "mongoose";
import { hashPassword } from '../../_config/bcrypt';
import { verifyCompany } from "../company/company.service";
import { createUserRole } from './role/roles.service';
import { getData } from "../../util/queryBuilder";
import { get } from "lodash";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id, isActive: true };
    if(userRole !== 'admin') {
      match._id = user_id;
    }
    const data: IUser[] = await getData(User, { filter: match, populate: 'account_id' });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
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
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match = { account_id: account_id, _id: id, isActive: true };
    const data: IUser[] | null = await getData(User, { filter: match, populate: 'account_id' });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
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
    const { locationID } = req.params;
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
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
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const password = await hashPassword(body.password);
    const companyData = await verifyCompany(`${account_id}`);
    if(!companyData) {
      throw Object.assign(new Error('Invalid account'), { status: 403 });
    }
    const newUser = new User({
      "firstName" : body.firstName,
      "lastName" : body.lastName,
      "username" : body.username,
      "password" : password,
      "email" : body.email,
      "user_role" : body.user_role,
      "account_id" : account_id,
      "phone_no" : {
          "number" : body.phone_no.number,
          "internationalNumber" : body.phone_no.internationalNumber,
          "nationalNumber" : body.phone_no.nationalNumber,
          "e164Number" : body.phone_no.e164Number,
          "countryCode" : body.phone_no.countryCode,
          "dialCode" : body.phone_no.dialCode
      }
    });
    const newUserDetails = await newUser.save();
    const roleData = await createUserRole(body.user_role, newUserDetails)
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: newUserDetails, roleData });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body;
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const userData = await User.findById(id);
    if(!userData) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if(body.user_profile_img) {
      userData.user_profile_img = body.user_profile_img;
    }
    const data = await User.findByIdAndUpdate(id, userData, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
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
    const data = await User.findById(id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await User.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};