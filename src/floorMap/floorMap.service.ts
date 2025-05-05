import { EndpointLocation, IEndpointLocation } from "../_models/floorMap.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IEndpointLocation[]> => {
  try {
    return await EndpointLocation.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};