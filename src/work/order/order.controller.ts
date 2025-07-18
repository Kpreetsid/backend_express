import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById, orderStatus, orderPriority, monthlyCount, plannedUnplanned, summaryData, pendingOrders } from './order.service';

export const getOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getAll(req, res, next);
}

export const getOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await getDataById(req, res, next);
}

export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await insert(req, res, next);
}

export const updateOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await updateById(req, res, next);
}

export const removeOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await removeById(req, res, next);
}

export const getOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await orderStatus(req, res, next);
}

export const getOrderPriority = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await orderPriority(req, res, next);
}

export const getMonthlyCount = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await monthlyCount(req, res, next);
}

export const getPlannedUnplanned = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await plannedUnplanned(req, res, next);
}

export const getSummaryData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await summaryData(req, res, next);
}

export const getPendingOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  await pendingOrders(req, res, next);
}