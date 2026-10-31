import { emailLoginService } from '../../auth/email-login/email-login.service';
import { UserModel, IUser, UserLoginPayload } from "../models/user.model";
import { MapUserAssetLocationModel } from "../../mappings/models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import { passwordService } from '../../../common/utils/bcrypt.helper';
import { rolesService } from './roles.service';
import { helperService } from '../../../common/utils/helper';
import { MailerService } from "../../../core/mailer/mailer.service";
import { TokenModel } from '../../auth/models/userToken.model';
import { tokenSessionStore } from '../../../core/auth/token-session-store';
import { validateNewPassword } from '../../auth/services/verification-challenge.service';
import { nextPasswordExpiry } from '../../auth/services/password-expiry';
import { RoleManager } from "../../../common/constants/new-user-roles.constant";
import { RoleMenuModel } from "../models/userRoleMenu.model";

import { withTransaction } from "../../../common/utils/transaction.helper";
import { subscriptionLimitService } from "../../company/services/subscriptionLimit.service";
import { assertStrongPassword } from '../../../common/utils/passwordPolicy';

class UsersService {

  private _mailerService?: MailerService;
  private get mailerService(): MailerService {
    if (!this._mailerService) {
      const { MailerService } = require("../../../core/mailer/mailer.service");
      this._mailerService = new MailerService();
    }
    return this._mailerService!;
  }

  constructor(mailerService?: MailerService) {
    if (mailerService) {
      this._mailerService = mailerService;
    }
  }

  async getAllUsers(match: any) {
    return await UserModel.find(match).select('-password');
  };

  async updateNewRoleMenu() {
    const userList = await UserModel.find({});
    for (const user of userList) {
      if (user.user_role) {
        const newRoleMenu = await RoleManager.getRoleMenuData(user.user_role);
        await RoleMenuModel.updateOne({ user_id: user._id }, { roleMenu: newRoleMenu });
        console.log(`Updated user role menu for user: ${user._id}, role: ${user.user_role}`);
      } else {
        console.log(`User role not found for user: ${user._id}`);
      }
    }
  }

  async getUserDetails(match: any) {
    return await UserModel.findOne(match).select('+password');
  };

  async verifyUserLogin({ id, companyID, username }: UserLoginPayload) {
    return await UserModel.findOne({
      _id: id,
      account_id: companyID,
      username,
      user_status: 'active',
      isVerified: true
    }).select('-password');
  };

  async userVerified(id: string) {
    return await UserModel.findOneAndUpdate({ _id: id }, { isVerified: true }, { returnDocument: 'after' });
  };

  async getLocationWiseUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { params: { locationID } } = req;
      const currentUser = (req as any).user as IUser;
      if (!currentUser?.account_id) {
        throw Object.assign(new Error('Unauthorized access'), { status: 401 });
      }
      const locationId = helperService.validateObjectId(String(locationID));
      const data = await MapUserAssetLocationModel.find({ locationId: locationId }).select('userId -_id');
      const userIDList = data.map((doc: any) => doc.userId);
      const userData = await this.getAllUsers({
        _id: { $in: userIDList },
        account_id: currentUser.account_id,
        user_status: 'active'
      });
      if (userData.length === 0) {
        throw Object.assign(new Error('No records found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: "Data fetched successfully", data: userData });;
    } catch (error) {
      next(error);
    }
  };

  async createNewUser(body: IUser, account_id: any, session?: any) {
    await subscriptionLimitService.assertCanCreate(account_id, 'user', 1, session);
    assertStrongPassword(body.password);
    body.password = await passwordService.hashPassword(body.password);

    let userDetails: any;
    try {
      const newUser = new UserModel({ ...body, account_id });
      userDetails = await newUser.save({ session });
      const roleDetails = await rolesService.createUserRole(body.user_role, userDetails, session);
      const safeUserDetails: any = userDetails.toObject();
      delete safeUserDetails.password;
      return { userDetails: safeUserDetails, roleDetails };
    } catch (error) {
      if (!session && userDetails?._id) {
        await UserModel.deleteOne({ _id: userDetails._id, account_id });
      }
      throw error;
    }
  };

  async updateUserPassword(user_id: any, password: string, account_id: any): Promise<void> {
    validateNewPassword(password);
    const hashedPassword = await passwordService.hashPassword(password);
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: user_id, account_id, user_status: 'active', visible: { $ne: false } },
      { $set: { password: hashedPassword, passwordExpiredAt: nextPasswordExpiry() } },
      { returnDocument: 'after' }
    );
    if (!updatedUser) throw Object.assign(new Error('User not found'), { status: 404 });
    await TokenModel.deleteMany({ userId: user_id, $or: [
      { principalType: { $in: ['user', 'refresh_token'] } },
      { principalType: { $exists: false } }
    ] });
    await tokenSessionStore.deleteUserSessions(String(account_id), String(user_id));
    try {
      await this.mailerService.sendPasswordChangeConfirmation(updatedUser);
    } catch {
      console.warn('Password updated, but confirmation email delivery failed.');
    }
  };

  async updateUserDetails(id: string, accountId: any, body: Partial<IUser>) {
    if (body.user_status === 'inactive' || (body as any).visible === false) await emailLoginService.revokeUser(id, String(accountId), 'system', 'user-disabled');
    return await UserModel.findOneAndUpdate(
      { _id: id, account_id: accountId },
      { $set: body },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async removeById(id: string, accountId: any) {
    await emailLoginService.revokeUser(id, String(accountId), 'system', 'user-disabled');
    return await withTransaction(async (session) => {
      await MapUserAssetLocationModel.deleteMany({ userId: id }, { session });
      return await UserModel.findOneAndUpdate(
        { _id: id, account_id: accountId },
        { $set: { user_status: 'inactive' } },
        { returnDocument: 'after', session, runValidators: true }
      );
    });
  };
}

export const usersService = new UsersService();
