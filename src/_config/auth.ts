import { expressjwt } from 'express-jwt';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { auth } from '../configDB';
import { verifyUserLogin } from '../masters/user/user.service';
import { IUserRoleMenu } from "../_models/userRoleMenu.model";
import { IUser, UserLoginPayload } from '../_models/user.model';
import { verifyUserRole } from '../masters/user/role/role.service';
import { verifyCompany } from '../masters/company/company.service';

export const authenticateJwt = expressjwt({
  secret: auth.secret,
  algorithms: [auth.algorithm as jwt.Algorithm],
  requestProperty: 'auth',
  issuer: auth.issuer,
  audience: auth.audience
});

export const attachUserData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, username, email, companyID } = (req as any).auth;
    const accountID = req.headers.accountid as string;
    if (!id && !username && !email && !companyID) {
      const error = new Error("Invalid token");
      (error as any).status = 401;
      throw error;
    }
    const companyData = await verifyCompany(accountID);
    if(!companyData) {
      const error = new Error("Account ID is invalid");
      (error as any).status = 401;
      throw error;
    }
    const userData: IUser | null = await verifyUserLogin({ id, companyID, email, username });
    if (!userData) {
      const error = new Error("User not found");
      (error as any).status = 404;
      throw error;
    }
    const userRole: IUserRoleMenu | null = await verifyUserRole(id, companyID);
    if (!userRole) {
      const error = new Error("User role not found");
      (error as any).status = 404;
      throw error;
    }
    if (userRole.account_id.toString() !== companyID) {
      const error = new Error("User role does not belong to the company");
      (error as any).status = 403;
      throw error;
    }
    req.user = userData;
    req.role = userRole.data;
    req.companyID = companyID;
    next();
  } catch (error) {
    next(error);
  }
};

export const generateAccessToken = (payload: UserLoginPayload): string => {
  return jwt.sign(payload, auth.secret, {
    expiresIn: auth.expiresIn,
    algorithm: auth.algorithm as jwt.Algorithm,
    issuer: auth.issuer,
    audience: auth.audience
  } as jwt.SignOptions); 
};