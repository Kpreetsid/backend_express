import { WorkOrder, IWorkOrder } from "../../_models/workOrder.model";
import { Request, Response, NextFunction } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<IWorkOrder[]> => {
  try {
    return await WorkOrder.find({}).sort({ _id: -1 });
  } catch (error) {
    next(error);
    throw error;     
  }
};