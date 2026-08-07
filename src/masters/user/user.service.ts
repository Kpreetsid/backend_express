import { UserModel, IUser, UserLoginPayload } from "../../models/user.model";
import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import { passwordService } from '../../utils/bcrypt';
import { rolesService } from './role/roles.service';
import { helperService } from '../../utils/helper';
import { MailerService } from "../../_config/mailer";
import { RoleManager } from "../../_role/newUserRoles";
import { RoleMenuModel } from "../../models/userRoleMenu.model";

import { withTransaction } from "../../utils/transaction.helper";

class UsersService {

  constructor(private mailerService: MailerService) {}

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
    return await UserModel.findOne({ _id: id, account_id: companyID, username: username }).select('-password');
  };

  async userVerified(id: string) {
    return await UserModel.findOneAndUpdate({ _id: id }, { isVerified: true }, { returnDocument: 'after' });
  };

  async getLocationWiseUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { params: { locationID } } = req;
      const locationId = helperService.validateObjectId(locationID);
      const data = await MapUserAssetLocationModel.find({ locationId: locationId }).select('userId -_id');
      const userIDList = data.map((doc: any) => doc.userId);
      const userData = await this.getAllUsers({ _id: { $in: userIDList } });
      if (userData.length === 0) {
        throw Object.assign(new Error('No records found'), { status: 404 });
      }
      return res.status(200).json({ status: true, message: "Data fetched successfully", data: userData });;
    } catch (error) {
      next(error);
    }
  };

  async createNewUser(body: IUser, account_id: any, session?: any) {
    body.password = await passwordService.hashPassword(body.password);
    
    // Use the provided session (or explicitly use the fallback if session is undefined but provided in arguments)
    const newUser = new UserModel({ ...body, account_id });
    const userDetails = await newUser.save({ session });
    const roleDetails = await rolesService.createUserRole(body.user_role, userDetails, session);
    return { userDetails, roleDetails };
  };

  async updateUserPassword(user_id: any, body: any) {
    body.password = await passwordService.hashPassword(body.password);
    const updatedUser = await UserModel.findByIdAndUpdate(user_id, body, { returnDocument: 'after' });
    await this.mailerService.sendPasswordChangeConfirmation(updatedUser);
    return updatedUser;
  };

  async updateUserDetails(id: string, body: IUser) {
    return await UserModel.findByIdAndUpdate(id, body, { returnDocument: 'after' });
  }

  async removeById(id: string) {
    return await withTransaction(async (session) => {
      await MapUserAssetLocationModel.deleteMany({ userId: id }, { session });
      return await UserModel.findByIdAndUpdate(id, { visible: false, user_status: 'inactive' }, { returnDocument: 'after', session });
    });
  };
}

export const usersService = new UsersService(new MailerService());