import { Request, Response, NextFunction } from 'express';
import { getAll, getDataById, insert, updateById, removeById } from './observation.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
const moduleName: string = "asset";

export const getObservations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await getAll(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const getObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await getDataById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const createObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const role = get(req, "role", {}) as any;
    if (!role?.[moduleName]?.add_observation) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    console.log({ account_id, user_id, userRole });
    await insert(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const updateObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await updateById(req, res, next);
  } catch (error) {
    next(error);
  }
}

export const removeObservation = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    await removeById(req, res, next);
  } catch (error) {
    next(error);
  }
}