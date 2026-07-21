import { Request, Response, NextFunction } from "express";
import { decodedAccessToken } from "../../_config/auth";
import { rolesService } from "../../masters/user/role/roles.service";
import { companyService } from "../../masters/company/company.service";
import { accountAccessService } from "../../_role/accountAccess.service";
import { usersService } from "../../masters/user/user.service";
import { TokenModel } from "../../models/userToken.model";

class UserTokenService {
  async getAllUserTokens (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { token } = req.params;
      if(!token) {
        throw Object.assign(new Error('Invalid link'), { status: 401 });
      }
      const data = await TokenModel.find({_id: token});
      if (data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const userData: any = decodedAccessToken(String(token));
      if(!userData.id && !userData.username && !userData.email && !userData.companyID) {
        throw Object.assign(new Error('Invalid link'), { status: 401 });
      }
      const getUserDetails = await usersService.verifyUserLogin({ id: userData.id, companyID: userData.companyID, username: userData.username });
      if (!getUserDetails) {
        throw Object.assign(new Error('User not found'), { status: 404 });
      }
      const { password: _, ...safeUser } = getUserDetails.toObject();
      const userRoleData = await rolesService.verifyUserRole(`${getUserDetails._id}`, `${getUserDetails.account_id}`);
      if (!userRoleData) {
        throw Object.assign(new Error('User does not have any permission'), { status: 403 });
      }
      const accountDetails = await companyService.getAllCompanies({ _id: getUserDetails.account_id });
      const effectivePermissions = accountAccessService.getEffectivePermissions(userRoleData, accountDetails?.[0]);
      return res.status(200).json({
        status: true,
        message: "Data fetched successfully",
        data: {
          userDetails: safeUser,
          accountDetails: accountDetails[0],
          token,
          platformControl: effectivePermissions.platformControl,
          roleMenu: effectivePermissions.roleMenu,
          accountPermissionVersion: Number(accountDetails[0]?.account_permission_version || 1)
        }
      });
    } catch (error) {
      next(error);     
    }
  };
  
  async createUserToken (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { userId, token } = req.body;
      const userToken = new TokenModel({ userId, token });
      await userToken.save();
      return res.status(201).json({ status: true, message: "Data inserted successfully", data: userToken });
    } catch (error) {
      next(error);     
    }
  }
}

export const userTokenService = new UserTokenService();
