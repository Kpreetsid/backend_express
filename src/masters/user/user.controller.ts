import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { usersService } from './user.service';
import { IUser } from '../../models/user.model';
import { resetPasswordService } from '../../user/resetPassword/resetPassword.service';
import { passwordService } from '../../_config/bcrypt';
import mongoose from 'mongoose';

class UserController {
  async getUsers (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, user_role } = get(req, "user", {}) as IUser;
      const match: any = { account_id, user_status: "active" };
      if (user_role === "admin") delete match.user_status;
      const data = await usersService.getAllUsers(match);
      if (!data.length) throw Object.assign(new Error("No data found"), { status: 404 });
      res.status(200).json({ status: true, message: "Users fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async getUser (req: Request, res: Response, next: NextFunction) {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) throw Object.assign(new Error("Bad request"), { status: 400 });
      const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, user_status: "active" };
      const data = await usersService.getAllUsers(match);
      if (!data.length) throw Object.assign(new Error("No data found"), { status: 404 });
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async getLocationWiseUsers (req: Request, res: Response, next: NextFunction) {
    try {
      return await usersService.getLocationWiseUser(req, res, next);
    } catch (error) {
      next(error);
    }
  };
  
  async createUser (req: Request, res: Response, next: NextFunction) {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const body = req.body;
      const emailExists = await usersService.getAllUsers({ email: body.email });
      if (emailExists.length) throw Object.assign(new Error("Email already exists"), { status: 400 });
  
      const usernameExists = await usersService.getAllUsers({ username: body.username });
      if (usernameExists.length) throw Object.assign(new Error("Username already exists"), { status: 400 });
  
      body.account_id = account_id;
      body.createdBy = user_id;
  
      const data = await usersService.createNewUser(body, account_id);
      res.status(201).json({ status: true, message: "Data created successfully", data: data.userDetails, roleData: data.roleDetails });
    } catch (error) {
      next(error);
    }
  };
  
  async updateUser (req: Request, res: Response, next: NextFunction) {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) throw Object.assign(new Error("Bad request"), { status: 400 });
      const match: any = { _id: new mongoose.Types.ObjectId(id), account_id };
      const userData = await usersService.getAllUsers(match);
      if (!userData.length) throw Object.assign(new Error("No data found"), { status: 404 });
      const data = await usersService.updateUserDetails(id, { ...userData[0].toObject(), ...body, updatedBy: user_id });
      if (!data) throw Object.assign(new Error("No data found"), { status: 404 });
      res.status(200).json({ status: true, message: "User updated successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
  async updatePasswordUser (req: Request, res: Response, next: NextFunction) {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const match = { _id: user_id, account_id, user_status: "active" };
      const userData = await usersService.getUserDetails(match);
      if (!userData) throw Object.assign(new Error("No user found"), { status: 404 });
      const { password, newPassword, confirmNewPassword } = req.body;
      if (!password || !newPassword || !confirmNewPassword)
        throw Object.assign(new Error("Password, new password and confirm password are required"), { status: 400 });
      if (newPassword !== confirmNewPassword)
        throw Object.assign(new Error("Passwords do not match"), { status: 400 });
  
      const isCorrect = await passwordService.comparePassword(password, userData.password);
      if (!isCorrect) throw Object.assign(new Error("Incorrect current password"), { status: 400 });
      userData.password = newPassword;
      await usersService.updateUserPassword(user_id, userData);
      res.status(200).json({ status: true, message: "User updated successfully" });
    } catch (error) {
      next(error);
    }
  };
  
  async changeUserPassword (req: Request, res: Response, next: NextFunction) {
    try {
      const { email, newPassword, confirmNewPassword } = req.body;
      if (!email || !newPassword || !confirmNewPassword)
        throw Object.assign(new Error("Email, new password and confirm password are required"), { status: 400 });
      if (newPassword !== confirmNewPassword)
        throw Object.assign(new Error("Passwords do not match"), { status: 400 });
  
      const userData = await usersService.getAllUsers({ email, user_status: "active" });
      if (!userData.length) throw Object.assign(new Error("User not found"), { status: 404 });
      const otpExists = await resetPasswordService.verifyOTPExists({ email });
      if (!otpExists) throw Object.assign(new Error("OTP has expired"), { status: 404 });
      userData[0].password = newPassword;
      await usersService.updateUserPassword(`${userData[0]._id}`, userData[0]);
      await resetPasswordService.deleteVerificationCode({ email });
      res.status(200).json({ status: true, message: "Password updated successfully" });
    } catch (error) {
      next(error);
    }
  };
  
  async removeUser (req: Request, res: Response, next: NextFunction) {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) throw Object.assign(new Error("Bad request"), { status: 400 });
      const match = { _id: id, account_id, user_status: "active" };
      const userData = await usersService.getAllUsers(match);
      if (!userData.length)
        throw Object.assign(new Error("No data found or already deleted"), { status: 404 });
      await usersService.removeById(id);
      res.status(200).json({ status: true, message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();