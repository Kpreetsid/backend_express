import { Request, Response, NextFunction } from 'express';
import { getAll, mappedData, createMapUserWorkOrders } from './userWorkOrder.service';

export const getUserWorkOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await getAll(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const getMappedData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await mappedData(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const setUserWorkOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    await createMapUserWorkOrders(req, res, next);
  } catch (error) {
    next(error);
  }
};