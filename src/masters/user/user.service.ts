import { UserModel, IUser, UserLoginPayload } from "../../models/user.model";
import { MapUserAssetLocationModel } from "../../models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';
import { passwordService } from '../../util/bcrypt';
import { rolesService } from './role/roles.service';
import mongoose from 'mongoose';
import { MailerService } from "../../_config/mailer";
import { RoleManager } from "../../_role/newUserRoles";
import { RoleMenuModel } from "../../models/userRoleMenu.model";

class UsersService {
  private mailerService: MailerService;

  constructor() {
    this.mailerService = new MailerService();
  }
  
  async getAllUsers(match: any) {
    return await UserModel.find(match).select('-password');
  };

  async updateNewRoleMenu() {
    const userList = await UserModel.find({});
    for (const user of userList) {
      if(user.user_role) {
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
    return await UserModel.findOneAndUpdate({ _id: id }, { isVerified: true }, { new: true });
  };

  async getLocationWiseUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { params: { locationID } } = req;
      if (!locationID || !mongoose.Types.ObjectId.isValid(String(locationID))) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const data = await MapUserAssetLocationModel.find({ locationId: new mongoose.Types.ObjectId(String(locationID)) }).select('userId -_id');
      if (data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const userIDList = data.map((doc: any) => doc.userId);
      const userData = await this.getAllUsers({ _id: { $in: userIDList } });
      return res.status(200).json({ status: true, message: "Data fetched successfully", data: userData });;
    } catch (error) {
      next(error);
    }
  };

  async createNewUser(body: IUser, account_id: any) {
    body.password = await passwordService.hashPassword(body.password);
    const newUser = new UserModel({ ...body, account_id });
    const userDetails = await newUser.save();
    const roleDetails = await rolesService.createUserRole(body.user_role, userDetails);
    return { userDetails, roleDetails };
  };

  async updateUserPassword(user_id: any, body: any) {
    body.password = await passwordService.hashPassword(body.password);
    const updatedUser = await UserModel.findByIdAndUpdate(user_id, body, { new: true });
    await this.mailerService.sendPasswordChangeConfirmation(updatedUser);
    return updatedUser;
  };

  async updateUserDetails(id: string, body: IUser) {
    return await UserModel.findByIdAndUpdate(id, body, { new: true });
  }

  async removeById(id: string) {
    await MapUserAssetLocationModel.deleteMany({ userId: id });
    return await UserModel.findByIdAndUpdate(id, { visible: false, user_status: 'inactive' }, { new: true });
  };
}

export const usersService = new UsersService();