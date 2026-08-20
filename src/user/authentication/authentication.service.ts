import mongoose from "mongoose";
import { IUser, UserModel, UserLoginPayload } from "../../models/user.model";
import { Request, Response, NextFunction } from 'express';
import { passwordService } from '../../utils/bcrypt';
import { decryptToken, generateAccessToken, generateExternalAccessToken } from '../../_config/auth';
import { TokenModel } from "../../models/userToken.model";
import { rolesService } from "../../masters/user/role/roles.service";
import { MailerService } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { auth } from "../../configDB";
import { helperService } from "../../utils/helper";
import { IAccount, AccountModel } from "../../models/account.model";
import { companyService } from "../../masters/company/company.service";
import { get } from "lodash";
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { analysisFeatureService } from "../../masters/analysisFeature/analysisFeature.service";

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
    const analysisFeature = await analysisFeatureService.getFeatureData({ account_id: user.account_id })
    const token_id = new mongoose.Types.ObjectId();
    const ttlSeconds = helperService.parseDurationSeconds(auth.expiresIn);
    const value = new Date(Date.now() + ttlSeconds * 1000);
    const userTokenData = new TokenModel({
      _id: token,
      token_id: token_id,
      userId: user._id,
      principalType: 'user',
      ttl: ttlSeconds,
      expiresAt: value
    });
    await userTokenData.save();
    res.status(200).json({
      status: true, message: 'Login successful', data: {
        token, token_id, accountDetails: userAccount[0], userDetails: safeUser, platformControl: userRoleData.data, roleMenu: userRoleData.roleMenu, analysisFeature: analysisFeature,
      }
    });
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
    const ttlSeconds = helperService.parseDurationSeconds(auth.expiresIn);
    const userTokenData = new TokenModel({
      _id: token,
      userId: user._id,
      principalType: 'user',
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    res.status(200).json({ status: true, message: 'Login successful', data: { token, org_id: user.account_id, user_id: user._id } });
  } catch (error) {
    next(error);
  }
};

export const createAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const identifier = String(req.params.email || req.params.accountId || req.params.id || '').trim();
    const { type } = req.query;
    if (!identifier) {
      throw Object.assign(new Error('Bad request: identifier is required'), { status: 400 });
    }

    const ttlSeconds = helperService.parseDurationSeconds(auth.expiresIn);

    if (type === 'DOWNLOAD_DATA') {
      if (!mongoose.Types.ObjectId.isValid(identifier)) {
        throw Object.assign(new Error('Invalid account ID for download token'), { status: 400 });
      }

      const account = await AccountModel.findOne({ _id: identifier, visible: true });
      if (!account) {
        throw Object.assign(new Error('Account data not found'), { status: 404 });
      }

      const match: any = {
        org_id: account._id,
        account_name: account.account_name,
        isExternal: false,
        isInternal: false,
        isDownloadData: true,
        type: 'DOWNLOAD_DATA'
      };
      await TokenModel.deleteMany({ account_id: account._id, principalType: 'download_data' });
      const external_token = generateExternalAccessToken(match);
      const tokenData = new TokenModel({
        _id: external_token,
        tokenType: 'access',
        token_id: new mongoose.Types.ObjectId(),
        account_id: account._id,
        principalType: 'download_data',
        isExternal: true,
        isInternal: false,
        ttl: ttlSeconds,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000)
      });
      await tokenData.save();

      return res.status(200).json({
        status: true,
        message: 'Download token generated successfully',
        data: { external_token, account_id: account._id, account_name: account.account_name }
      });
    }

    // Interactive user login token
    const external_user = await UserModel.findOne({ email: identifier, user_status: 'active' });
    if (!external_user) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }

    const match: any = {
      email: external_user.email,
      org_id: external_user.account_id,
      isExternal: false,
      isInternal: true
    };
    const external_token = generateExternalAccessToken(match);
    const userTokenData = new TokenModel({
      _id: external_token,
      tokenType: 'access',
      token_id: new mongoose.Types.ObjectId(),
      userId: external_user._id,
      account_id: external_user.account_id,
      principalType: 'user',
      isExternal: true,
      isInternal: false,
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();

    return res.status(200).json({
      status: true,
      message: 'Login successful',
      data: { external_token, org_id: external_user.account_id, user_id: external_user._id }
    });
  } catch (error) {
    next(error);
  }
};

export const userAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { body: { external_token } } = req;
    if (!external_token) {
      throw Object.assign(new Error('Bad request'), { status: 404 });
    }
    const decoded = decryptToken(external_token);
    const { email, org_id, isExternal, isInternal, isDownloadData, redirectPath } = decoded;
    if (!email && !org_id) {
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    if (true === !!isDownloadData) {
      throw Object.assign(new Error(`User can't access this application resource.`), { status: 401 });
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
    const ttlSeconds = helperService.parseDurationSeconds(auth.expiresIn);
    const userTokenData = new TokenModel({
      _id: newToken,
      userId: userDetails._id,
      principalType: 'user',
      isExternal,
      isInternal,
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    await userTokenData.save();
    const safeRedirectPath = typeof redirectPath === 'string' && redirectPath.startsWith('/')
      ? redirectPath
      : '/dashboard';
    const analysisFeature = await analysisFeatureService.getFeatureData({ account_id: userDetails.account_id })
    res.status(200).json(
      {
        status: true,
        message: 'Login successful',
        data: {
          token: newToken,
          accountDetails: accountDetails[0],
          userDetails: newSafeUserValue,
          platformControl: userRoleMenu.data,
          roleMenu: userRoleMenu.roleMenu,
          analysisFeature: analysisFeature,
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
    const userToken = await TokenModel.findOne({ _id: token });
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
    const userToken = get(req, 'userToken');
    const [accessToken] = await Promise.all([
      TokenModel.deleteMany({ _id: userToken, userId: { $exists: true } }),
      // TokenModel.deleteMany({ _id: { $exists: true }, userId: helperService.validateObjectId(user_id) })
    ]);
    console.log({ accessToken, user_id });
    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};
