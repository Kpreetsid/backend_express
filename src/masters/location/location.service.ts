import { LocationMaster, ILocationMaster } from "../../_models/location.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<ILocationMaster[]> => {
  try {
    return await LocationMaster.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};