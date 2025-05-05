import { User, IUser } from "../../_models/user.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IUser[]> => {
  try {
    return await User.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};