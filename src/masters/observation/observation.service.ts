import { Observation, IObservation } from "../../_models/observation.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IObservation[]> => {
  try {
    return await Observation.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};