// utils/auth.ts
import { expressjwt, Request as JWTRequest } from 'express-jwt';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../_models/user.model';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// 1. Express-jwt middleware to decode and verify token
export const authenticateJwt = expressjwt({
  secret: JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'auth', // temporarily store decoded token
});

// 2. Middleware to fetch user from DB and assign to req.user
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
      res.status(404).json({ message: 'User not found' });
      const error = new Error("User not found");
      (error as any).status = 404;
      throw error;
    }
    req.user = user; 
    next();
  } catch (error) {
    next(error); // important to call next(error)
  }
};

// 3. Generate token using user _id
export const generateToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
};
