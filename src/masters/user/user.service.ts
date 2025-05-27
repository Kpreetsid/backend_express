import { User, IUser, UserLoginPayload } from "../../models/user.model";
import { MapUserLocation } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import mongoose from "mongoose";
import { hashPassword } from '../../_config/bcrypt';
import { verifyCompany } from "../company/company.service";
import { createUserRole } from './role/roles.service';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const data: IUser[] | null = await User.find({}).populate('account_id').sort({ _id: -1 });
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
    const { account_id, _id: user_id } = req.user;
    const data: IUser[] | null = await User.find({_id: id, account_id: account_id}).populate('account_id');
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
    if(req.user.user_role !== "admin") {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const data = await MapUserLocation.find({ locationId: new mongoose.Types.ObjectId(locationID) }).select('userId -_id');
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
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
    const body = req.body;
    const { account_id, _id: user_id } = req.user;
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
    const data = await User.findByIdAndUpdate(id, req.body, { new: true });
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