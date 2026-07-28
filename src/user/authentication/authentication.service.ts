import mongoose from "mongoose";
import { IUser, UserModel, UserLoginPayload } from "../../models/user.model";
import { Request, Response, NextFunction } from 'express';
import { passwordService } from '../../utils/bcrypt';
import { decryptToken, generateAccessToken, generateExternalAccessToken } from '../../_config/auth';
import { getAccessTokenTypeFilter, TokenModel } from "../../models/userToken.model";
import { rolesService } from "../../masters/user/role/roles.service";
import { MailerService } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { auth } from "../../configDB";
import { helperService } from "../../utils/helper";
import { IAccount } from "../../models/account.model";
import { companyService } from "../../masters/company/company.service";
import { get } from "lodash";
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { refreshTokenService } from "./refreshToken.service";
import { parseTtlSeconds } from "../../utils/ttl";

const issueRefreshTokenOrRollback = async (user: IUser, accessToken: string): Promise<string> => {
  try {
    return await refreshTokenService.issue(user);
  } catch (error) {
    await TokenModel.deleteOne({ _id: accessToken, ...getAccessTokenTypeFilter() });
    throw error;
  }
};

export const userAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const restrictedRoles = ['manager', 'employee', 'customer', 'user'];
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
    const userAccount: IAccount[] | null = await companyService.getAllCompanies(accountMatch);
    if (!userAccount || userAccount.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    const isMatch = await passwordService.comparePassword(password, user.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    if (!user.isVerified) {
      throw Object.assign(new Error("Unverified user"), { status: 403 });
    }
    const getFirstUser = await UserModel.findOne({ account_id: user.account_id, isFirstUser: true, user_status: 'active' });
    if (!getFirstUser) {
      throw Object.assign(new Error('Your account has been locked. Please contact support team.'), { status: 401 });
    }
    if (restrictedRoles.includes(user.user_role)) {
      const locationList = await mapUserToLocationService.getLocationsMappedData(user._id);
      if (!locationList || locationList.length === 0) {
        throw Object.assign(new Error('User does not have any location'), { status: 401 });
      }
    }
    const { password: _, ...safeUser } = user.toObject();
    safeUser.id = safeUser._id;
    const userTokenPayload: UserLoginPayload = { id: String(user._id), username: user.username, companyID: String(user.account_id) };
    const token = generateAccessToken(userTokenPayload);
    let userRoleData: any = await rolesService.verifyUserRole(String(user._id), String(user.account_id));
    if (!userRoleData) {
      userRoleData = await rolesService.createUserRole(user.user_role, user);
    }
    const token_id = new mongoose.Types.ObjectId();
    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const userTokenData = new TokenModel({
      _id: token,
      tokenType: 'access',
      token_id: token_id,
      userId: user._id,
      principalType: 'user',
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    const refreshToken = await issueRefreshTokenOrRollback(user, token);
    res.status(200).json({ status: true, message: 'Login successful', data: { token, token_id, refreshToken, accountDetails: userAccount[0], userDetails: safeUser, platformControl: userRoleData.data, roleMenu: userRoleData.roleMenu } });
  } catch (error) {
    next(error);
  }
};

export const userAuthenticationToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
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
    const userAccount: IAccount[] | null = await companyService.getAllCompanies(accountMatch);
    if (!userAccount || userAccount.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    const isMatch = await passwordService.comparePassword(password, user.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    if (user.user_role !== 'admin') {
      const locationList = await mapUserToLocationService.getLocationsMappedData(user._id);
      if (!locationList || locationList.length === 0) {
        throw Object.assign(new Error('User does not have any location'), { status: 401 });
      }
    }
    const { password: _, ...safeUser } = user.toObject();
    safeUser.id = safeUser._id;
    const userTokenPayload: UserLoginPayload = { id: String(user._id), username: user.username, companyID: String(user.account_id) };
    const token = generateAccessToken(userTokenPayload);
    let userRoleData: any = await rolesService.verifyUserRole(String(user._id), String(user.account_id));
    if (!userRoleData) {
      userRoleData = await rolesService.createUserRole(user.user_role, user);
    }
    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const userTokenData = new TokenModel({
      _id: token,
      tokenType: 'access',
      userId: user._id,
      principalType: 'user',
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    const refreshToken = await issueRefreshTokenOrRollback(user, token);
    res.status(200).json({ status: true, message: 'Login successful', data: { token, refreshToken, org_id: user.account_id, user_id: user._id } });
  } catch (error) {
    next(error);
  }
};

export const createAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { email } } = req;
    if (!email) {
      throw Object.assign(new Error('Bad request'), { status: 404 });
    }
    const external_user = await UserModel.findOne({ email, user_status: 'active' });
    if (!external_user) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const external_token = generateExternalAccessToken({ email, org_id: external_user.account_id, isExternal: false, isInternal: true });
    res.status(200).json({ status: true, message: 'Login successful', data: { external_token } });
  } catch (error) {
    next(error);
  }
}

export const userAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { body: { external_token } } = req;
    if (!external_token) {
      throw Object.assign(new Error('Bad request'), { status: 404 });
    }
    const decoded = decryptToken(external_token);
    const { email, org_id, isExternal, isInternal, redirectPath } = decoded;
    if (!email && !org_id) {
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    const userDetails = await UserModel.findOne({ email, account_id: helperService.validateObjectId(org_id), user_status: 'active' });
    if (!userDetails) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const { password: _, ...safeUser } = userDetails.toObject();
    const newSafeUserValue: any = { id: safeUser._id, ...safeUser }
    const accountDetails = await companyService.getAllCompanies({ _id: userDetails.account_id });
    if (!accountDetails || accountDetails.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    let userRoleMenu: any = await rolesService.verifyUserRole(String(userDetails._id), String(userDetails.account_id));
    if (!userRoleMenu) {
      userRoleMenu = await rolesService.createUserRole(userDetails.user_role, userDetails);
    }
    const userTokenPayload: UserLoginPayload = { id: String(userDetails._id), username: userDetails.username, companyID: String(userDetails.account_id) };
    const newToken = generateAccessToken(userTokenPayload);
    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    const userTokenData = new TokenModel({
      _id: newToken,
      tokenType: 'access',
      userId: userDetails._id,
      principalType: 'user',
      isExternal,
      isInternal,
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    const refreshToken = await issueRefreshTokenOrRollback(userDetails, newToken);
    const safeRedirectPath = typeof redirectPath === 'string' && redirectPath.startsWith('/')
      ? redirectPath
      : '/dashboard';

    res.status(200).json(
      { 
        status: true, 
        message: 'Login successful', 
        data: { 
          token: newToken,
          refreshToken,
          accountDetails: accountDetails[0], 
          userDetails: newSafeUserValue, 
          platformControl: userRoleMenu.data, 
          roleMenu: userRoleMenu.roleMenu, 
          isExternal: !!isExternal,
          isInternal: !!isInternal,
          redirectPath: safeRedirectPath
        } 
      });
  } catch (error) {
    next(error);
  }
};

export const userResetPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  const mailerService = new MailerService();
  try {
    const { token, password } = req.body;
    if (!token) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const userToken = await TokenModel.findOne({
      _id: token,
      ...getAccessTokenTypeFilter()
    });
    if (!userToken) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const user = await UserModel.findOne({ _id: userToken.userId });
    if (!user) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const hashNewPassword = await passwordService.hashPassword(password);
    await UserModel.updateOne({ _id: user._id, account_id: user.account_id }, { $set: { password: hashNewPassword } });
    await mailerService.sendPasswordChangeConfirmation(user);
    await VerificationCodeModel.deleteOne({ email: user.email, code: token.toString() });
    return res.status(200).json({ status: true, message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
}

export const userLogOutService = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user_id = get(req, 'user_id');
    const userToken = String(get(req, 'userToken') || '');
    if (!userToken) {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const refreshToken = String(req.headers['x-cmms-refresh-token'] || '');
    const [accessToken] = await Promise.all([
      TokenModel.deleteMany({
        _id: userToken,
        userId: { $exists: true },
        ...getAccessTokenTypeFilter()
      }),
      refreshTokenService.revoke(refreshToken),
      // TokenModel.deleteMany({ _id: { $exists: true }, userId: helperService.validateObjectId(user_id) })
    ]);
    console.log({ accessToken, user_id });
    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};
