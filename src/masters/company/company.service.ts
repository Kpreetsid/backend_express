import { Account, IAccount } from "../../_models/account.model";
import { Request, Response, NextFunction } from 'express';

export const getAllAccount = async (req: Request, res: Response, next: NextFunction): Promise<IAccount[]> => {
  try {
    return await Account.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};