import { LocationReport, ILocationReport } from "../../_models/locationReport.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<ILocationReport[]> => {
  try {
    return await LocationReport.find({}).sort({ _id: -1 }).select('-timestamp');
  } catch (error) {
    next(error);
    throw error;     
  }
};