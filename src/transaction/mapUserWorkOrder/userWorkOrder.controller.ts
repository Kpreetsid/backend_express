import express, { Request, Response, NextFunction } from 'express';
import { getAll } from './userWorkOrder.service';

export const getUserWorkOrders = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
};