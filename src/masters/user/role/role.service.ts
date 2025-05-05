import { UserRoleMenu, IUserRoleMenu } from "../../../_models/userRoleMenu.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IUserRoleMenu[]> => {
  try {
    return await UserRoleMenu.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};