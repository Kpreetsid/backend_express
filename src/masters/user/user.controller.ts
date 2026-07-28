import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { usersService } from './user.service';
import { IUser } from '../../models/user.model';
import { resetPasswordService } from '../../user/resetPassword/resetPassword.service';
import { passwordService } from '../../utils/bcrypt';
import { applyRoleFilter } from '../../utils/roleFilter';
import { mailerService } from '../../_config/mailer';
import { helperService } from '../../utils/helper';
import { notificationService } from '../../utils/notification.service';

class UserController {

  async getUsers(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const baseFilter: any = { user_status: "active" };
      const { account_id, username } = req.query;
      if (account_id) {
        baseFilter.account_id = helperService.validateObjectId(String(account_id));
      }
      if (username) {
        baseFilter.$or = [{ username: username }, { email: username }];
      }
      if (user.user_role === "admin") {
        delete baseFilter.user_status;
      }
      const filter: any = await applyRoleFilter({ user, baseFilter, accountField: "account_id", createdByField: "createdBy" });
      delete filter.visible;
      const data = await usersService.getAllUsers(filter);
      if (!data.length) {
        throw Object.assign(new Error("No users found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Users retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async getUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), user_status: "active" };
      if (user.user_role === "admin") {
        delete baseFilter.user_status;
      }
      const filter: any = await applyRoleFilter({ user, baseFilter, accountField: "account_id", createdByField: "createdBy" });
      delete filter.visible;
      const data = await usersService.getAllUsers(filter);
      if (!data.length) {
        throw Object.assign(new Error("User not found"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "User retrieved successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getLocationWiseUsers(req: Request, res: Response, next: NextFunction) {
    try {
      return await usersService.getLocationWiseUser(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  async createUser(req: Request, res: Response, next: NextFunction) {
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
      await mailerService.sendUserCreatedMail({ userName: data.userDetails.username, userEmail: data.userDetails.email });
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'User',
        event: 'created',
        entityId: String(data.userDetails._id || data.userDetails.id),
        entityName: `${data.userDetails.firstName || ''} ${data.userDetails.lastName || ''}`.trim() || data.userDetails.username || 'User',
        actionUrl: `/admin-panel/users/${data.userDetails._id || data.userDetails.id}`,
        sourceUserId: String(user_id)
      });
      res.status(201).json({ status: true, message: "User created successfully", data: data.userDetails, roleData: data.roleDetails });
    } catch (error) {
      next(error);
    }
  };

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), user_status: 'active' };
      if (user.user_role === 'admin') {
        delete baseFilter.user_status;
      }
      const filter: any = await applyRoleFilter({ user, baseFilter, accountField: 'account_id', createdByField: 'createdBy' });
      delete filter.visible;
      const userData = await usersService.getAllUsers(filter);
      if (!userData.length) {
        throw Object.assign(new Error("User not found"), { status: 404 });
      }
      const existingUser = userData[0]!;
      const data = await usersService.updateUserDetails(String(id), { ...existingUser.toObject(), ...body, updatedBy: user._id });
      if (!data) {
        throw Object.assign(new Error("Failed to update user"), { status: 500 });
      }
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'User',
        event: 'updated',
        entityId: String(id),
        entityName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.username || 'User',
        actionUrl: `/admin-panel/users/${id}`,
        sourceUserId: String(user._id)
      });
      res.status(200).json({ status: true, message: "User updated successfully", data });
    } catch (error) {
      next(error);
    }
  };

  async updatePasswordUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const match = { _id: user_id, account_id, user_status: "active" };
      const userData = await usersService.getUserDetails(match);
      if (!userData) throw Object.assign(new Error("User not found"), { status: 404 });
      const { password, newPassword, confirmNewPassword } = req.body;
      if (!password || !newPassword || !confirmNewPassword)
        throw Object.assign(new Error("Password, new password and confirm password are required"), { status: 400 });
      if (newPassword !== confirmNewPassword)
        throw Object.assign(new Error("Passwords do not match"), { status: 400 });

      const isCorrect = await passwordService.comparePassword(password, userData.password);
      if (!isCorrect) throw Object.assign(new Error("Incorrect current password"), { status: 400 });
      userData.password = newPassword;
      userData.passwordExpiredAt = new Date();
      await usersService.updateUserPassword(user_id, userData);
      res.status(200).json({ status: true, message: "User password updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  async changeUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, newPassword, confirmNewPassword } = req.body;
      if (!email || !newPassword || !confirmNewPassword)
        throw Object.assign(new Error("Email, new password and confirm password are required"), { status: 400 });
      if (newPassword !== confirmNewPassword)
        throw Object.assign(new Error("Passwords do not match"), { status: 400 });

      const userData = await usersService.getAllUsers({ email, user_status: "active" });
      if (!userData.length) throw Object.assign(new Error("User not found"), { status: 404 });
      const existingUser = userData[0]!;
      const otpExists = await resetPasswordService.verifyOTPExists({ email });
      if (!otpExists) throw Object.assign(new Error("OTP has expired. Please request a new one."), { status: 410 });
      existingUser.password = newPassword;
      existingUser.passwordExpiredAt = new Date();
      await usersService.updateUserPassword(`${existingUser._id}`, existingUser);
      await resetPasswordService.deleteVerificationCode({ email });
      res.status(200).json({ status: true, message: "User password updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  async removeUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), user_status: 'active' };
      const filter: any = await applyRoleFilter({ user, baseFilter, accountField: 'account_id', createdByField: 'createdBy' });
      delete filter.visible;
      const userData = await usersService.getAllUsers(filter);
      if (!userData.length)
        throw Object.assign(new Error("User not found or already deleted"), { status: 404 });
      await usersService.removeById(String(id));
      res.status(200).json({ status: true, message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();
