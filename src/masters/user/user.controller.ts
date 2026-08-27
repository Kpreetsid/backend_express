import { controllerCache } from '../../_cache/controllerCache.service';

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
import { TokenModel } from '../../models/userToken.model';
import { clearAuthSessionCacheForUser } from '../../_config/auth';
import { assertStrongPassword } from '../../utils/passwordPolicy';
import { rolesService } from './role/roles.service';
import { withTransaction } from '../../utils/transaction.helper';

class UserController {
  constructor() {
    this.getUsers = this.getUsers.bind(this);
    this.getUser = this.getUser.bind(this);
    this.createUser = this.createUser.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this.updatePasswordUser = this.updatePasswordUser.bind(this);
    this.changeUserPassword = this.changeUserPassword.bind(this);
    this.removeUser = this.removeUser.bind(this);
    this.assertAccountAdmin = this.assertAccountAdmin.bind(this);
    this.pickAllowedFields = this.pickAllowedFields.bind(this);
  }

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
      if (['admin', 'super_admin', 'manager'].includes(String(user?.user_role || '').toLowerCase())) {
        delete baseFilter.user_status;
      }
      const filter: any = await applyRoleFilter({ user, baseFilter, accountField: "account_id", createdByField: "createdBy" });
      delete filter.visible;
      const data = await usersService.getAllUsers(filter);
      res.status(200).json({ status: true, message: "Users retrieved successfully", data: data || [] });
    } catch (error) {
      next(error);
    }
  };

  async getUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), user_status: "active" };
      if (['admin', 'super_admin', 'manager'].includes(String(user?.user_role || '').toLowerCase())) {
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
      const currentUser = get(req, "user", {}) as IUser;
      this.assertAccountAdmin(currentUser);
      const { account_id, _id: user_id } = currentUser;
      const body = req.body;
      const emailExists = await usersService.getAllUsers({ email: body.email });
      if (emailExists.length) throw Object.assign(new Error("Email already exists"), { status: 400 });

      const usernameExists = await usersService.getAllUsers({ username: body.username });
      if (usernameExists.length) throw Object.assign(new Error("Username already exists"), { status: 400 });

      body.account_id = account_id;
      body.createdBy = user_id;

      const data = await withTransaction(session => usersService.createNewUser(body, account_id, session));
      const sideEffects = await Promise.allSettled([
        mailerService.sendUserCreatedMail({ userName: data.userDetails.username, userEmail: data.userDetails.email }),
        notificationService.notifyAccountUsers({
        accountId: String(account_id),
        module: 'User',
        event: 'created',
        entityId: String(data.userDetails._id || data.userDetails.id),
        entityName: `${data.userDetails.firstName || ''} ${data.userDetails.lastName || ''}`.trim() || data.userDetails.username || 'User',
        actionUrl: `/admin-panel/users/${data.userDetails._id || data.userDetails.id}`,
        sourceUserId: String(user_id),
          recipientRoles: ['admin']
        })
      ]);
      sideEffects.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(index === 0 ? 'User welcome email failed' : 'User creation notification failed', result.reason);
        }
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

      const isAdmin = ['admin', 'super_admin', 'manager'].includes(String(user?.user_role || '').trim().toLowerCase());
      const isSelf = String(user._id) === String(id);
      if (!isAdmin && !isSelf) {
        throw Object.assign(new Error('Only an account administrator can update another user'), { status: 403 });
      }
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), user_status: 'active' };
      if (isAdmin) {
        delete baseFilter.user_status;
      }
      const filter: any = await applyRoleFilter({ user, baseFilter, accountField: 'account_id', createdByField: 'createdBy' });
      delete filter.visible;
      const userData = await usersService.getAllUsers(filter);
      if (!userData.length) {
        throw Object.assign(new Error("User not found"), { status: 404 });
      }
      const allowedFields = isAdmin
        ? ['firstName', 'lastName', 'username', 'email', 'phone_no', 'user_profile_img', 'user_status', 'user_role', 'isVerified']
        : ['firstName', 'lastName', 'phone_no', 'user_profile_img'];
      const safeUpdates = this.pickAllowedFields(body, allowedFields);
      if (!Object.keys(safeUpdates).length) {
        throw Object.assign(new Error('No permitted user fields were provided'), { status: 400 });
      }
      const previousUser = userData[0];
      if (previousUser.isFirstUser
        && ((safeUpdates.user_role && safeUpdates.user_role !== 'admin')
          || (safeUpdates.user_status && safeUpdates.user_status !== 'active')
          || safeUpdates.isVerified === false)) {
        throw Object.assign(new Error('The primary account administrator cannot be demoted, deactivated, or unverified'), { status: 400 });
      }
      if (isSelf
        && ((safeUpdates.user_role && safeUpdates.user_role !== 'admin')
          || (safeUpdates.user_status && safeUpdates.user_status !== 'active'))) {
        throw Object.assign(new Error('An administrator cannot demote or deactivate their own active session'), { status: 400 });
      }
      const roleChanged = Object.prototype.hasOwnProperty.call(safeUpdates, 'user_role')
        && safeUpdates.user_role !== previousUser.user_role;
      const securityContextChanged = ['username', 'email', 'user_status', 'user_role', 'isVerified']
        .some(field => Object.prototype.hasOwnProperty.call(safeUpdates, field)
          && String(safeUpdates[field]) !== String((previousUser as any)[field]));
      const data = await usersService.updateUserDetails(
        String(id),
        user.account_id,
        { ...safeUpdates, updatedBy: user._id } as Partial<IUser>
      );
      if (!data) {
        throw Object.assign(new Error("Failed to update user"), { status: 500 });
      }
      if (roleChanged) {
        await rolesService.resetUserRole(data.user_role, data, user._id);
      }
      if (securityContextChanged) {
        await TokenModel.deleteMany({ userId: data._id });
        clearAuthSessionCacheForUser(String(data._id));
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
      assertStrongPassword(newPassword);

      const isCorrect = await passwordService.comparePassword(password, userData.password);
      if (!isCorrect) throw Object.assign(new Error("Incorrect current password"), { status: 400 });
      await usersService.updateUserPassword(user_id, newPassword);
      await TokenModel.deleteMany({ userId: user_id });
      clearAuthSessionCacheForUser(String(user_id));
      res.status(200).json({ status: true, message: "User password updated successfully. Please sign in again." });
    } catch (error) {
      next(error);
    }
  };

  async changeUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, newPassword, confirmNewPassword, resetToken } = req.body;
      if (!email || !newPassword || !confirmNewPassword || !resetToken)
        throw Object.assign(new Error("Email, reset token, new password and confirm password are required"), { status: 400 });
      if (newPassword !== confirmNewPassword)
        throw Object.assign(new Error("Passwords do not match"), { status: 400 });
      assertStrongPassword(newPassword);

      const normalizedEmail = String(email).trim().toLowerCase();
      const resetProofConsumed = await resetPasswordService.consumeResetProof(normalizedEmail, String(resetToken));
      if (!resetProofConsumed) {
        throw Object.assign(new Error("Password reset verification has expired or was already used."), { status: 401 });
      }
      const userData = await usersService.getAllUsers({ email: normalizedEmail, user_status: "active" });
      if (!userData.length) {
        throw Object.assign(new Error("Password reset verification has expired or was already used."), { status: 401 });
      }
      await usersService.updateUserPassword(`${userData[0]._id}`, newPassword);
      await TokenModel.deleteMany({ userId: userData[0]._id });
      clearAuthSessionCacheForUser(String(userData[0]._id));
      res.status(200).json({ status: true, message: "User password updated successfully" });
    } catch (error) {
      next(error);
    }
  };

  async removeUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = get(req, "user", {}) as IUser;
      this.assertAccountAdmin(user);
      const { id } = req.params;
      if (String(user._id) === String(id)) {
        throw Object.assign(new Error('An administrator cannot delete their own active session'), { status: 400 });
      }
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), user_status: 'active' };
      const filter: any = await applyRoleFilter({ user, baseFilter, accountField: 'account_id', createdByField: 'createdBy' });
      delete filter.visible;
      const userData = await usersService.getAllUsers(filter);
      if (!userData.length)
        throw Object.assign(new Error("User not found or already deleted"), { status: 404 });
      if (userData[0].isFirstUser) {
        throw Object.assign(new Error('The primary account administrator cannot be deleted'), { status: 400 });
      }
      await usersService.removeById(String(id), user.account_id);
      await TokenModel.deleteMany({ userId: id });
      clearAuthSessionCacheForUser(String(id));
      res.status(200).json({ status: true, message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  private assertAccountAdmin(user: IUser): void {
    const role = String(user?.user_role || '').trim().toLowerCase();
    if (!user?._id || !['admin', 'super_admin', 'manager'].includes(role)) {
      throw Object.assign(new Error('Account administrator access is required'), { status: 403 });
    }
  }

  private pickAllowedFields(body: any, allowedFields: string[]): Record<string, any> {
    const source = body && typeof body === 'object' ? body : {};
    return allowedFields.reduce<Record<string, any>>((result, field) => {
      if (Object.prototype.hasOwnProperty.call(source, field)) {
        result[field] = source[field];
      }
      return result;
    }, {});
  }
}

export const userController = controllerCache.withCache(new UserController(), { namespace: 'users', ttlSeconds: 300, tags: ['users', 'roles', 'mappings'] });

