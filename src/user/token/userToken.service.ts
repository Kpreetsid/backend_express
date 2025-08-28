import { Request, Response, NextFunction } from "express";
import { decodedAccessToken } from "../../_config/auth";
import { verifyUserRole } from "../../masters/user/role/roles.service";
import { verifyUserLogin } from "../../masters/user/user.service";
import { TokenModel } from "../../models/userToken.model";

export const getAllUserTokens = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { token } = req.params;
    if(!token) {
      throw Object.assign(new Error('Invalid link'), { status: 401 });
    }
    const data = await TokenModel.find({_id: token});
    if (data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const userData = decodedAccessToken(token);
    if(!userData.id && !userData.username && !userData.email && !userData.companyID) {
      throw Object.assign(new Error('Invalid link'), { status: 401 });
    }
    const getUserDetails = await verifyUserLogin({ id: userData.id, companyID: userData.companyID, email: userData.email, username: userData.username });
    if (!getUserDetails) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const { password: _, ...safeUser } = getUserDetails.toObject();
    const userRoleData = await verifyUserRole(`${getUserDetails._id}`, `${getUserDetails.account_id}`);
    if (!userRoleData) {
      throw Object.assign(new Error('User does not have any permission'), { status: 403 });
    }
    res.cookie('token', token, { httpOnly: true, secure: true });
    res.cookie('companyID', safeUser.account_id, { httpOnly: true, secure: true });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: {userDetails: safeUser, token, platformControl: userRoleData.data} });
  } catch (error) {
    next(error);     
  }
};

export const createUserToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { userId, token } = req.body;
    const userToken = new TokenModel({ userId, token });
    await userToken.save();
    return res.status(201).json({ status: true, message: "Data inserted successfully", data: userToken });
  } catch (error) {
    next(error);     
  }
}