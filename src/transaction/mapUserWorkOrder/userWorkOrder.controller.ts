import express, { Request, Response, NextFunction } from 'express';
import { getAll, mappedData } from './userWorkOrder.service';

export const getUserWorkOrders = async (req: Request, res: Response, next: NextFunction) => {
  await getAll(req, res, next);
};

export const getMappedData = async (req: Request, res: Response, next: NextFunction) => {
  await mappedData(req, res, next);
};