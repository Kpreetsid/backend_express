import { controllerCache } from '../../../core/cache/controller-cache.service';
import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { usersService } from '../services/user.service';
import { IUser } from '../models/user.model';
import { resetPasswordService } from '../../auth/services/resetPassword.service';
import { passwordService } from '../../../common/utils/bcrypt.helper';
import { applyRoleFilter } from '../../../common/utils/role-filter.helper';
import { mailerService } from '../../../core/mailer/mailer.service';
import { helperService } from '../../../common/utils/helper';
import { notificationService } from '../../communications/services/notification-sender.service';
import { subscriptionLimitService } from '../../company/services/subscriptionLimit.service';
import { validateNewPassword } from '../../auth/services/verification-challenge.service';
import { clearAuthCookies } from '../../../core/auth/auth-cookie.service';
import { refreshTokenService } from '../../auth/services/refreshToken.service';
import { pickUserCreateFields, pickUserUpdateFields } from '../services/user-update-policy';

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
      const body = pickUserCreateFields(req.body);
      const emailExists = await usersService.getAllUsers({ email: body.email });
      if (emailExists.length) throw Object.assign(new Error("Email already exists"), { status: 400 });

      const usernameExists = await usersService.getAllUsers({ username: body.username });
      if (usernameExists.length) throw Object.assign(new Error("Username already exists"), { status: 400 });

      const createPayload = {
        ...body,
        account_id,
        createdBy: user_id
      } as IUser;

      const data = await usersService.createNewUser(createPayload, account_id);
      await mailerService.sendUserCreatedMail({ userName: data.userDetails.username, userEmail: data.userDetails.email });
      await notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'User',
        event: 'created',
        entityId: String(data.userDetails._id || data.userDetails.id),
        entityName: `${data.userDetails.firstName || ''} ${data.userDetails.lastName || ''}`.trim() || data.userDetails.username || 'User',
        actionUrl: `/admin-panel/users/${data.userDetails._id || data.userDetails.id}`,
        sourceUserId: String(user_id),
        recipientRoles: ['admin']
      });
      res.status(201).json({ status: true, message: "User created successfully", data: data.userDetails, roleData: data.roleDetails });
    } catch (error) {
      next(error);
    }
  };

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      const body = pickUserUpdateFields(req.body);
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
      if (userData[0].user_status !== 'active' && body.user_status === 'active') {
        await subscriptionLimitService.assertCanCreate(user.account_id, 'user');
      }
      const data = await usersService.updateUserDetails(
        String(id),
        { ...body, updatedBy: user._id } as Partial<IUser>,
        user.account_id
      );
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
        sourceUserId: String(user._id),
        recipientRoles: ['admin']
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
      validateNewPassword(newPassword, confirmNewPassword);
      await usersService.updateUserPassword(user_id, newPassword, account_id);
      clearAuthCookies(res);
      refreshTokenService.clearCookie(res);
      res.status(200).json({ status: true, message: "User password updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  async changeUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, resetToken, newPassword, confirmNewPassword } = req.body;
      if (!email || !newPassword || !confirmNewPassword)
        throw Object.assign(new Error("Email, new password and confirm password are required"), { status: 400 });
      if (newPassword !== confirmNewPassword)
        throw Object.assign(new Error("Passwords do not match"), { status: 400 });

      await resetPasswordService.completeReset({ email, token: resetToken, password: newPassword, confirmation: confirmNewPassword });
      clearAuthCookies(res);
      refreshTokenService.clearCookie(res);
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
      const removed = await usersService.removeById(String(id), user.account_id);
      if (!removed) {
        throw Object.assign(new Error("User not found or outside account"), { status: 404 });
      }
      res.status(200).json({ status: true, message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}

export const userController = controllerCache.withCache(new UserController(), { namespace: 'users', ttlSeconds: 300, tags: ['users', 'roles', 'mappings'] });
