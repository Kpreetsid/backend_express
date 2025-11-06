import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { getAllUsers, createNewUser, updateUserDetails, removeById, getLocationWiseUser, getUserDetails, updateUserPassword } from './user.service';
import { IUser } from '../../models/user.model';
import { deleteVerificationCode, verifyOTPExists } from '../../user/resetPassword/resetPassword.service';
import { comparePassword } from '../../_config/bcrypt';
import mongoose from 'mongoose';
import { redisGet, redisSet, redisDelete, redisDeletePattern, buildCacheKey } from "../../_redis/redis.operation";

export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, user_role } = get(req, "user", {}) as IUser;
    const match: any = { account_id, user_status: "active" };
    if (user_role === "admin") delete match.user_status;
    const cacheKey = buildCacheKey("users", `${account_id}`, user_role);
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, cached: true, message: "Users fetched successfully (cache)", data: cached });
      return;
    }
    const data = await getAllUsers(match);
    if (!data.length) throw Object.assign(new Error("No data found"), { status: 404 });
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Users fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if (!id) throw Object.assign(new Error("Bad request"), { status: 400 });
    const cacheKey = buildCacheKey("user", id);
    const cached = await redisGet(cacheKey);
    if (cached) {
      res.status(200).json({ status: true, cached: true, message: "Data fetched successfully (cache)", data: cached });
      return;
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, user_status: "active" };
    const data = await getAllUsers(match);
    if (!data.length) throw Object.assign(new Error("No data found"), { status: 404 });
    await redisSet(cacheKey, data, 600);
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getLocationWiseUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return await getLocationWiseUser(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    const emailExists = await getAllUsers({ email: body.email });
    if (emailExists.length) throw Object.assign(new Error("Email already exists"), { status: 400 });

    const usernameExists = await getAllUsers({ username: body.username });
    if (usernameExists.length) throw Object.assign(new Error("Username already exists"), { status: 400 });

    body.account_id = account_id;
    body.createdBy = user_id;

    const data = await createNewUser(body, account_id);
    await redisDeletePattern(buildCacheKey("users", `${account_id}`, "*"));
    res.status(201).json({ status: true, message: "Data created successfully", data: data.userDetails, roleData: data.roleDetails });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id) throw Object.assign(new Error("Bad request"), { status: 400 });
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, user_status: "active" };
    const userData = await getAllUsers(match);
    if (!userData.length) throw Object.assign(new Error("No data found"), { status: 404 });

    const data = await updateUserDetails(id, { ...userData[0], ...body, updatedBy: user_id });
    if (!data) throw Object.assign(new Error("No data found"), { status: 404 });
    await redisDelete(buildCacheKey("user", id));
    await redisDeletePattern(buildCacheKey("users", `${account_id}`, "*"));
    res.status(200).json({ status: true, message: "User updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updatePasswordUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const match = { _id: user_id, account_id, user_status: "active" };
    const userData = await getUserDetails(match);
    if (!userData) throw Object.assign(new Error("No user found"), { status: 404 });
    const { password, newPassword, confirmNewPassword } = req.body;
    if (!password || !newPassword || !confirmNewPassword)
      throw Object.assign(new Error("Password, new password and confirm password are required"), { status: 400 });
    if (newPassword !== confirmNewPassword)
      throw Object.assign(new Error("Passwords do not match"), { status: 400 });

    const isCorrect = await comparePassword(password, userData.password);
    if (!isCorrect) throw Object.assign(new Error("Incorrect current password"), { status: 400 });
    userData.password = newPassword;
    await updateUserPassword(user_id, userData);
    await redisDelete(buildCacheKey("user", `${user_id}`));
    res.status(200).json({ status: true, message: "User updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const changeUserPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, newPassword, confirmNewPassword } = req.body;
    if (!email || !newPassword || !confirmNewPassword)
      throw Object.assign(new Error("Email, new password and confirm password are required"), { status: 400 });
    if (newPassword !== confirmNewPassword)
      throw Object.assign(new Error("Passwords do not match"), { status: 400 });

    const userData = await getAllUsers({ email, user_status: "active" });
    if (!userData.length) throw Object.assign(new Error("User not found"), { status: 404 });
    const otpExists = await verifyOTPExists({ email });
    if (!otpExists) throw Object.assign(new Error("OTP has expired"), { status: 404 });
    userData[0].password = newPassword;
    await updateUserPassword(`${userData[0]._id}`, userData[0]);
    await deleteVerificationCode({ email });
    await redisDelete(buildCacheKey("user", `${userData[0]._id}`));
    res.status(200).json({ status: true, message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const removeUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if (!id) throw Object.assign(new Error("Bad request"), { status: 400 });
    const match = { _id: id, account_id, user_status: "active" };
    const userData = await getAllUsers(match);
    if (!userData.length)
      throw Object.assign(new Error("No data found or already deleted"), { status: 404 });
    await removeById(id);
    await redisDelete(buildCacheKey("user", id));
    await redisDeletePattern(buildCacheKey("users", `${account_id}`, "*"));
    res.status(200).json({ status: true, message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};