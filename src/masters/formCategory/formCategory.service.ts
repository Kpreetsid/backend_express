import { Category, ICategory } from "../../_models/formCategory.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<ICategory[]> => {
  try {
    return await Category.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};