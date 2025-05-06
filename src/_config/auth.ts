// utils/auth.ts
import { expressjwt } from 'express-jwt';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../_models/user.model';

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
      res.status(404).json({ message: 'User not found' });
      const error = new Error("User not found");
      (error as any).status = 404;
      throw error;
    }
    req.user = user; 
    next();
  } catch (error) {
    next(error); 
  }
};

export const generateToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
};
