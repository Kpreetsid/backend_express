// utils/auth.ts
import { expressjwt } from 'express-jwt';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../_models/user.model';
import { UserRoleMenu } from "../_models/userRoleMenu.model";
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

export const authenticateJwt = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'auth'
});

export const attachUserData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, username, email, companyID } = (req as any).auth;
    if (!id || !username || !email || !companyID) {
      const error = new Error("Invalid token");
      (error as any).status = 401;
      throw error;
    }
    const user = await User.findOne({ _id: id, account_id: companyID, email, username }).select('-password');
    if (!user) {
      const error = new Error("User not found");
      (error as any).status = 404;
      throw error;
    }
    const userRole = await UserRoleMenu.findOne({ user_id: new mongoose.Types.ObjectId(id), account_id: new mongoose.Types.ObjectId(companyID)});
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
    req.user = user; 
    req.role = userRole.data;
    req.companyID = companyID;
    next();
  } catch (error) {
    next(error); 
  }
};

export const generateToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
};
