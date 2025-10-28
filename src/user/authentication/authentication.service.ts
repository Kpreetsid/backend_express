import { IUser, UserModel, UserLoginPayload } from "../../models/user.model";
import { Request, Response, NextFunction } from 'express';
import { comparePassword, hashPassword } from '../../_config/bcrypt';
import { generateAccessToken } from '../../_config/auth';
import { TokenModel } from "../../models/userToken.model";
import { verifyUserRole } from "../../masters/user/role/roles.service";
import { sendPasswordChangeConfirmation } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { auth } from "../../configDB";
import { IAccount } from "../../models/account.model";
import { getAllCompanies } from "../../masters/company/company.service";
import { get } from "lodash";
import jwt from 'jsonwebtoken';
import { getLocationsMappedData } from "../../transaction/mapUserLocation/userLocation.service";
import { ExternalUserModel } from "../../models/map_user.model";
import mongoose from "mongoose";

export const userAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { $or: [{ username: username }, { email: username }], user_status: 'active' };
    const user: IUser | null = await UserModel.findOne(match).select('+password');
    if (!user) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const accountMatch = { _id: user.account_id };
    const userAccount: IAccount[] | null = await getAllCompanies(accountMatch);
    if (!userAccount || userAccount.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    if(!user.isVerified) {
      throw Object.assign(new Error('Unverified user'), { status: 403 });
    }
    if(user.user_role !== 'admin') {
      const locationList = await getLocationsMappedData(user._id || user.id);
      if (!locationList || locationList.length === 0) {
        throw Object.assign(new Error('User does not have any location'), { status: 401 });
      }
    }
    const { password: _, ...safeUser } = user.toObject();
    safeUser.id = safeUser._id;
    const userTokenPayload: UserLoginPayload = { id: `${user._id}`, username: user.username, companyID: `${user.account_id}` };
    const token = generateAccessToken(userTokenPayload);
    const userRoleData = await verifyUserRole(`${user._id}`, `${user.account_id}`);
    if (!userRoleData) {
      throw Object.assign(new Error('User does not have any permission'), { status: 403 });
    }
    res.cookie('token', token, { httpOnly: true, secure: false , sameSite: 'lax'});
    res.cookie('accountID', userTokenPayload.companyID, { httpOnly: true, secure: false, sameSite: 'lax' });
    const userTokenData = new TokenModel({
      _id: token,
      userId: user._id,
      principalType: 'user',
      ttl: parseInt(auth.expiresIn as string)
    });
    await userTokenData.save();
    res.status(200).json({ status: true, message: 'Login successful', data: {token, accountDetails: userAccount[0], userDetails: safeUser, platformControl: userRoleData.data} });
  } catch (error) {
    next(error);
  }
};

export const userAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { token }} = req;
    if(!token) {
      throw Object.assign(new Error('Bad request'), { status: 404 });
    }
    const decoded = jwt.verify(token, auth.external_secret, {
      algorithms: [auth.algorithm as jwt.Algorithm],
      issuer: auth.issuer,
      audience: auth.audience
    }) as UserLoginPayload;
    const { id, username, companyID } = decoded;
    if (!id || !username || !companyID) {
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    const mappedUser = await ExternalUserModel.findOne({ username, customer_id: new mongoose.Types.ObjectId(id), account_id: new mongoose.Types.ObjectId(companyID) });
    if (!mappedUser) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const userDetails = await UserModel.findOne({ _id: mappedUser.user_id, account_id: companyID, user_status: 'active' });
    if (!userDetails) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const { password: _, ...safeUser } = userDetails.toObject();
    safeUser.id = safeUser._id;
    const accountDetails = await getAllCompanies({ _id: companyID });
    if (!accountDetails || accountDetails.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    const userRoleMenu = await verifyUserRole(`${userDetails._id}`, `${userDetails.account_id}`);
    if (!userRoleMenu) {
      throw Object.assign(new Error('User does not have any permission'), { status: 403 });
    }
    const userTokenPayload: UserLoginPayload = { id: `${userDetails._id}`, username: userDetails.username, companyID: `${userDetails.account_id}` };
    const newToken = generateAccessToken(userTokenPayload);
    res.cookie('token', newToken, { httpOnly: true, secure: false , sameSite: 'lax'});
    res.cookie('accountID', userTokenPayload.companyID, { httpOnly: true, secure: false, sameSite: 'lax' });
    const userTokenData = new TokenModel({
      _id: newToken,
      userId: userDetails._id,
      principalType: 'user',
      ttl: parseInt(auth.expiresIn as string)
    });
    await userTokenData.save();
    res.status(200).json({ status: true, message: 'Login successful', data: {token: newToken, accountDetails: accountDetails[0], userDetails: safeUser, platformControl: userRoleMenu.data} });
  } catch (error) {
    next(error);
  }
};

export const userResetPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { token, password } = req.body;
    if(!token) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const userToken = await TokenModel.findOne({ _id: token });
    if (!userToken) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const user = await UserModel.findOne({ _id: userToken.userId });
    if (!user) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const hashNewPassword = await hashPassword(password);
    await UserModel.updateOne({ _id: user._id, account_id: user.account_id }, { $set: { password: hashNewPassword } });
    await sendPasswordChangeConfirmation(user);
    await VerificationCodeModel.deleteOne({ email: user.email, code: token.toString() });
    return res.status(200).json({ status: true, message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
}

export const userLogOutService = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { _id: user_id } = get(req, "user", {}) as IUser;
    console.log('User ID:', user_id);
    // await UserToken.deleteMany({ userId: user_id });
    res.clearCookie('token');
    res.clearCookie('companyID');
    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};