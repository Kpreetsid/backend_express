import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById, orderStatus, orderPriority, monthlyCount, plannedUnplanned, summaryData, pendingOrders } from './order.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';

export const getOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await getAll(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await getDataById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await insert(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const updateOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await updateById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const removeOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await removeById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getOrderStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await orderStatus(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getOrderPriority = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await orderPriority(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getMonthlyCount = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await monthlyCount(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getPlannedUnplanned = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await plannedUnplanned(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getSummaryData = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await summaryData(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getPendingOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await pendingOrders(req, res, next);
  } catch (error) {
    next(error);
  }
}