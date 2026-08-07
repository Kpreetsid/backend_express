import { applicationLogger } from '../../../observability/logger';
import { RoleMenuModel, IUserRoleMenu } from "../../../models/userRoleMenu.model";
import { IUser } from "../../../models/user.model";
import { PlatformControlManager } from "../../../_role/userRoles";
import { RoleManager } from "../../../_role/newUserRoles";
import { helperService } from "../../../utils/helper";

class RolesService {
  async getRoles(match: any): Promise<any> {
    return await RoleMenuModel.find(match);
  }

  async verifyUserRole(id: string, companyID: string) {
    try {
      const userId = helperService.validateObjectId(id);
      const companyId = helperService.validateObjectId(companyID);
      const userRole: IUserRoleMenu | null = await RoleMenuModel.findOne({ user_id: userId, account_id: companyId });
      if (!userRole) {
        return null;
      }
      return userRole;
    } catch (error) {
      return null;
    }
  }

  async insertRole(data: object, roleMenu: object, account_id: any, target_user_id: any, actor_user_id: any): Promise<any> {
    const newUserRoleMenu: IUserRoleMenu = new RoleMenuModel({
      account_id,
      user_id: target_user_id,
      data,
      roleMenu,
      createdBy: actor_user_id
    });
    return await newUserRoleMenu.save();
  }

  async createUserRole(userRole: any, userData: IUser, session?: any) {
    try {
      var platformControl = await PlatformControlManager.getRoleMenuData(userRole);
      var newRoleMenu = await RoleManager.getRoleMenuData(userRole);
      const newUserRoleMenu: IUserRoleMenu = new RoleMenuModel({
        account_id: userData.account_id,
        user_id: userData._id,
        data: platformControl,
        roleMenu: newRoleMenu,
        createdBy: userData._id
      });
      return await newUserRoleMenu.save({ session });
    } catch (error) {
      applicationLogger.error(error);
      return null;
    }
  }

  async updateById(id: any, account_id: any, data: object, user_id: any): Promise<any> {
    return await RoleMenuModel.findOneAndUpdate(
      { _id: id, account_id },
      { $set: { data, updatedBy: user_id } },
      { returnDocument: 'after' }
    );
  }

  async removeById(id: any, account_id: any, user_id: any): Promise<any> {
    return await RoleMenuModel.findOneAndUpdate(
      { _id: id, account_id },
      { $set: { updatedBy: user_id, visible: false } },
      { returnDocument: 'after' }
    );
  }
}

export const rolesService = new RolesService();
