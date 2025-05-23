import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { auth } from '../configDB';
import { verifyUserLogin } from '../masters/user/user.service';
import { IUserRoleMenu } from "../models/userRoleMenu.model";
import { IUser, UserLoginPayload } from '../models/user.model';
import { verifyUserRole } from '../masters/user/role/roles.service';
import { verifyCompany } from '../masters/company/company.service';

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookieToken = req.cookies['token'];
    const cookieAccountID = req.cookies['accountID'];
    if (!cookieToken || !cookieAccountID) {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const decoded = jwt.verify(cookieToken, auth.secret, {
      algorithms: [auth.algorithm as jwt.Algorithm],
      issuer: auth.issuer,
      audience: auth.audience
    }) as UserLoginPayload;
    const { id, username, email, companyID } = decoded;
    const accountID = req.headers.accountid as string;

    if (!id || !username || !email || !companyID || cookieAccountID !== accountID) {
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }
    const companyData = await verifyCompany(accountID);
    if (!companyData) {
      throw Object.assign(new Error('Account ID is invalid'), { status: 401 });
    }
    const userData: IUser | null = await verifyUserLogin({ id, companyID, email, username });
    if (!userData) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const userRole: IUserRoleMenu | null = await verifyUserRole(id, companyID);
    if (!userRole) {
      throw Object.assign(new Error('User role not found'), { status: 401 });
    }
    if (userRole.account_id.toString() !== companyID) {
      throw Object.assign(new Error('User does not belong to the company'), { status: 403 });
    }
    req.user = userData;
    req.companyID = companyID;
    next();
  } catch (error: any) {
    console.error('Auth error:', error.message);
    next(error)
  }
};

export const decodedAccessToken = (token: string): JwtPayload => {
  return jwt.decode(token) as JwtPayload;
};

export const generateAccessToken = (payload: UserLoginPayload): string => {
  return jwt.sign(payload, auth.secret, {
    expiresIn: auth.expiresIn,
    algorithm: auth.algorithm as jwt.Algorithm,
    issuer: auth.issuer,
    audience: auth.audience
  } as jwt.SignOptions); 
};