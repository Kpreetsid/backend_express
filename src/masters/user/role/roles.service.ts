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

  async insertRole(body: any, account_id: any, target_user_id: any, actor_user_id: any): Promise<any> {
    const newUserRoleMenu: IUserRoleMenu = new RoleMenuModel({
      data: body.data,
      roleMenu: body.roleMenu,
      account_id,
      user_id: target_user_id,
      createdBy: actor_user_id
    });
    return await newUserRoleMenu.save();
  }

  async createUserRole(userRole: any, userData: IUser, session?: any) {
    const platformControl = await PlatformControlManager.getRoleMenuData(userRole);
    const newRoleMenu = await RoleManager.getRoleMenuData(userRole);
    const newUserRoleMenu: IUserRoleMenu = new RoleMenuModel({
      account_id: userData.account_id,
      user_id: userData._id,
      data: platformControl,
      roleMenu: newRoleMenu,
      createdBy: userData._id
    });
    return await newUserRoleMenu.save({ session });
  }

  async updateById(id: any, account_id: any, data: any, user_id: any): Promise<any> {
    return await RoleMenuModel.findOneAndUpdate(
      { $or: [{ _id: id }, { user_id: id }], account_id },
      { $set: { data, updatedBy: user_id } },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async resetUserRole(userRole: any, userData: IUser, actorUserId: any): Promise<any> {
    const [data, roleMenu] = await Promise.all([
      PlatformControlManager.getRoleMenuData(userRole),
      RoleManager.getRoleMenuData(userRole)
    ]);
    return await RoleMenuModel.findOneAndUpdate(
      { user_id: userData._id, account_id: userData.account_id },
      {
        $set: { data, roleMenu, updatedBy: actorUserId },
        $setOnInsert: { createdBy: actorUserId }
      },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  async removeById(id: any, account_id: any): Promise<any> {
    return await RoleMenuModel.findOneAndDelete({ _id: id, account_id });
  }
}

export const rolesService = new RolesService();
