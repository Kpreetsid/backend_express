import { MapUserLocation, IMapUserLocation } from "../../_models/mapUserLocation.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IMapUserLocation[]> => {
  try {
    return await MapUserLocation.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};