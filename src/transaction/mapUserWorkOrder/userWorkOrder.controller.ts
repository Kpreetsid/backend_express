import express, { Request, Response, NextFunction } from 'express';
import { getAll, mappedData } from './userWorkOrder.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';

export const getUserWorkOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await getAll(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getMappedData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    await mappedData(req, res, next);
  } catch (error) {
    console.error(error);
    next(error);
  }
};