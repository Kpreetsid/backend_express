import { UserToken, IUserToken } from "../../_models/userToken.model";
import { Request, Response, NextFunction } from 'express';

export const getAllUserTokens = async (req: Request, res: Response, next: NextFunction): Promise<IUserToken[]> => {
  try {
    return await UserToken.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};