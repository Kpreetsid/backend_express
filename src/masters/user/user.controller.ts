import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAllUsers, createNewUser, updateUserDetails, removeById, getLocationWiseUser, getUserDetails, updateUserPassword } from './user.service';
import { IUser } from '../../models/user.model';
import { deleteVerificationCode, verifyOTPExists } from '../../user/resetPassword/resetPassword.service';
import { comparePassword } from '../../_config/bcrypt';
import mongoose from 'mongoose';

export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id, user_status: 'active' };
    const data = await getAllUsers(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(req.params.id), account_id, user_status: 'active' };
    if (userRole !== 'admin') {
      match._id = user_id;
    }
    const data = await getAllUsers(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getLocationWiseUsers = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await getLocationWiseUser(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const body = req.body;
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const checkMailId = await getAllUsers({ email: body.email });
    if (checkMailId && checkMailId.length > 0) {
      throw Object.assign(new Error('Email already exists'), { status: 400 });
    }
    const checkUserName = await getAllUsers({ username: body.username });
    if (checkUserName && checkUserName.length > 0) {
      throw Object.assign(new Error('Username already exists'), { status: 400 });
    }
    body.account_id = account_id;
    body.createdBy = user_id;
    const data: any = await createNewUser(body, account_id);
    res.status(201).json({ status: true, message: "Data created successfully", data: data.userDetails, roleData: data.roleDetails });
  } catch (error) {
    next(error);
  }
}

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match = { _id: req.params.id, account_id: account_id, user_status: 'active' };
    const userData = await getAllUsers(match);
    if (!userData || userData.length === 0) {
      throw Object.assign(new Error('No data found or already deleted'), { status: 404 });
    }
    req.body.updatedBy = user_id;
    await updateUserDetails(req.params.id, req.body);
    const data = await getAllUsers(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    data[0].id = data[0]._id;
    res.status(200).json({ status: true, message: "User updated successfully", data: data[0] });
  } catch (error) {
    next(error);
  }
}

export const updatePasswordUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const match = { _id: user_id, account_id: account_id, user_status: 'active' };
    const userData = await getUserDetails(match);
    if (!userData) {
      throw Object.assign(new Error('No user found'), { status: 404 });
    }
    const { password, newPassword, confirmNewPassword } = req.body;
    if (!password || !newPassword || !confirmNewPassword) {
      throw Object.assign(new Error('Password, new password and confirm password are required'), { status: 400 });
    }
    if (newPassword !== confirmNewPassword) {
      throw Object.assign(new Error('Passwords do not match'), { status: 400 });
    }
    const checkPassword = await comparePassword(password, userData.password);
    if (!checkPassword) {
      throw Object.assign(new Error('Incorrect current password'), { status: 400 });
    }
    userData.password = newPassword;
    await updateUserPassword(user_id, userData);
    res.status(200).json({ status: true, message: "User updated successfully" });
  } catch (error) {
    next(error);
  }
}

export const changeUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { email, newPassword, confirmNewPassword } = req.body;
    if (!email || !newPassword || !confirmNewPassword) {
      throw Object.assign(new Error('Email, new password and confirm password are required'), { status: 400 });
    }
    if (newPassword !== confirmNewPassword) {
      throw Object.assign(new Error('Passwords do not match'), { status: 400 });
    }
    const userData = await getAllUsers({ email: email, user_status: 'active' });
    if (!userData || userData.length === 0) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const match = { email: userData[0].email, firstName: userData[0].firstName, lastName: userData[0].lastName };
    const otpExists = await verifyOTPExists(match);
    if (!otpExists) {
      throw Object.assign(new Error('OTP has expired'), { status: 404 });
    }
    userData[0].password = newPassword;
    const updatedData = await updateUserPassword(`${userData[0]._id}`, userData[0]);
    if (!updatedData) {
      throw Object.assign(new Error('Failed to update password'), { status: 500 });
    }
    await deleteVerificationCode({ email: match.email });
    res.status(200).json({ status: true, message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
}

export const removeUser = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    if (!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: req.params.id, account_id: account_id, user_status: 'active' };
    const userData = await getAllUsers(match);
    if (!userData || userData.length === 0) {
      throw Object.assign(new Error('No data found or already deleted'), { status: 404 });
    }
    await removeById(req.params.id);
    res.status(200).json({ status: true, message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
}