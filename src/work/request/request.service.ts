import { Blog, IBlog } from "../../_models/help.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IBlog[]> => {
  try {
    return await Blog.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};