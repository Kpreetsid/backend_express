import { IUser, UserModel, UserLoginPayload } from "../../models/user.model";
import { Request, Response, NextFunction } from 'express';
import { passwordService } from '../../util/bcrypt';
import { decryptToken, generateAccessToken, generateExternalAccessToken } from '../../_config/auth';
import { TokenModel } from "../../models/userToken.model";
import { rolesService } from "../../masters/user/role/roles.service";
import { sendPasswordChangeConfirmation } from "../../_config/mailer";
import { VerificationCodeModel } from "../../models/userVerification.model";
import { auth } from "../../configDB";
import { IAccount } from "../../models/account.model";
import { companyService } from "../../masters/company/company.service";
import { get } from "lodash";
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";

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
    if(!user.isVerified) {
      throw Object.assign(new Error('Unverified user'), { status: 403 });
    }
    if (restrictedRoles.includes(user.user_role)) {
      const locationList = await mapUserToLocationService.getLocationsMappedData(user._id);
      if (!locationList || locationList.length === 0) {
        throw Object.assign(new Error('User does not have any location'), { status: 401 });
      }
    }
    const { password: _, ...safeUser } = user.toObject();
    safeUser.id = safeUser._id;
    const userTokenPayload: UserLoginPayload = { id: `${user._id}`, username: user.username, companyID: `${user.account_id}` };
    const token = generateAccessToken(userTokenPayload);
    const userRoleData = await rolesService.verifyUserRole(`${user._id}`, `${user.account_id}`);
    if (!userRoleData) {
      throw Object.assign(new Error('User does not have any permission'), { status: 403 });
    }
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: '.presageinsights.ai',
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });
    res.cookie("accountID", userTokenPayload.companyID, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: '.presageinsights.ai',
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });
    const userTokenData = new TokenModel({
      _id: token,
      userId: user._id,
      principalType: 'user',
      ttl: parseInt(auth.expiresIn as string)
    });
    await userTokenData.save();
    res.status(200).json({ status: true, message: 'Login successful', data: {token, accountDetails: userAccount[0], userDetails: safeUser, platformControl: userRoleData.data, roleMenu: userRoleData.roleMenu} });
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
    if(!user.isVerified) {
      throw Object.assign(new Error('Unverified user'), { status: 403 });
    }
    if(user.user_role !== 'admin') {
      const locationList = await mapUserToLocationService.getLocationsMappedData(user._id);
      if (!locationList || locationList.length === 0) {
        throw Object.assign(new Error('User does not have any location'), { status: 401 });
      }
    }
    const { password: _, ...safeUser } = user.toObject();
    safeUser.id = safeUser._id;
    const userTokenPayload: UserLoginPayload = { id: `${user._id}`, username: user.username, companyID: `${user.account_id}` };
    const token = generateAccessToken(userTokenPayload);
    const userRoleData = await rolesService.verifyUserRole(`${user._id}`, `${user.account_id}`);
    if (!userRoleData) {
      throw Object.assign(new Error('User does not have any permission'), { status: 403 });
    }
    res.cookie("token", token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      domain: '.presageinsights.ai', 
      path: "/", 
      maxAge: 1000 * 60 * 60 * 24 * 7 
    });
    res.cookie("accountID", userTokenPayload.companyID, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      domain: '.presageinsights.ai', 
      path: "/", 
      maxAge: 1000 * 60 * 60 * 24 * 7 
    });
    const userTokenData = new TokenModel({
      _id: token,
      userId: user._id,
      principalType: 'user',
      ttl: parseInt(auth.expiresIn as string)
    });
    await userTokenData.save();
    res.status(200).json({ status: true, message: 'Login successful', data: { token, org_id: user.account_id, user_id: user._id } });
  } catch (error) {
    next(error);
  }
};

export const createAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { params: { email }} = req;
    if(!email) {
      throw Object.assign(new Error('Bad request'), { status: 404 });
    }
    const external_user = await UserModel.findOne({ email, user_status: 'active' });
    if (!external_user) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const external_token = generateExternalAccessToken(email);
    res.status(200).json({ status: true, message: 'Login successful', data: { external_token } });
  } catch (error) {
    next(error);
  }
}

export const userAuthenticationByToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { body: { external_token }} = req;
    if(!external_token) {
      throw Object.assign(new Error('Bad request'), { status: 404 });
    }
    const decoded = decryptToken(external_token);
    const { email } = decoded;
    if (!email) {
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    const userDetails = await UserModel.findOne({ email, user_status: 'active' });
    if (!userDetails) {
      throw Object.assign(new Error('User data not found'), { status: 404 });
    }
    const { password: _, ...safeUser } = userDetails.toObject();
    const newSafeUserValue: any = { id: safeUser._id, ...safeUser }
    const accountDetails = await companyService.getAllCompanies({ _id: userDetails.account_id });
    if (!accountDetails || accountDetails.length === 0) {
      throw Object.assign(new Error('User account not found'), { status: 404 });
    }
    const userRoleMenu = await rolesService.verifyUserRole(`${userDetails._id}`, `${userDetails.account_id}`);
    if (!userRoleMenu) {
      throw Object.assign(new Error('User does not role permissions'), { status: 403 });
    }
    const userTokenPayload: UserLoginPayload = { id: `${userDetails._id}`, username: userDetails.username, companyID: `${userDetails.account_id}` };
    const newToken = generateAccessToken(userTokenPayload);
    res.cookie("token", newToken, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      domain: '.presageinsights.ai', 
      path: "/", 
      maxAge: 1000 * 60 * 60 * 24 * 7 
    });
    res.cookie("accountID", userTokenPayload.companyID, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      domain: '.presageinsights.ai', 
      path: "/", 
      maxAge: 1000 * 60 * 60 * 24 * 7 
    });
    const userTokenData = new TokenModel({
      _id: newToken,
      userId: userDetails._id,
      principalType: 'user',
      ttl: parseInt(auth.expiresIn as string)
    });
    await userTokenData.save();
    res.status(200).json({ status: true, message: 'Login successful', data: {token: newToken, accountDetails: accountDetails[0], userDetails: newSafeUserValue, platformControl: userRoleMenu.data} });
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
    const hashNewPassword = await passwordService.hashPassword(password);
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
    const user_id = get(req, 'user_id');
    const userToken = get(req, 'userToken');
    const data = await TokenModel.deleteMany({ _id: userToken, userId: user_id });
    console.log('Data:', data);
    const options = { httpOnly: true, secure: true, sameSite: "none" as const, domain: '.presageinsights.ai', path: "/" };
    res.cookie("token", "", { ...options, expires: new Date(0) });
    res.cookie("accountID", "", { ...options, expires: new Date(0) });
    res.clearCookie('token', options);
    res.clearCookie('accountID', options);
    Object.keys(req.cookies || {}).forEach((cookieName) => {
      res.clearCookie(cookieName, options);
    });
    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};