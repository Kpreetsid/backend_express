import { Part, IPart } from "../../_models/part.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IPart[]> => {
  try {
    return await Part.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};