import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { getAll, insert, updateById, removeById } from './parts.service';
import { IUser } from '../../models/user.model';

export const getParts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id: account_id };
    if(userRole !== 'admin') {
      match.createdBy = user_id;
    }
    const data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
}

export const getPart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: req.params.id, account_id: account_id };
    if(userRole !== 'admin') {
      match.createdBy = user_id;
    }
    const data = await getAll(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error: any) {
    next(error);
  }
}

export const createPart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const user = get(req, "user", {}) as IUser;
    const data = await insert(req.body, user);
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error: any) {
    next(error);
  }
}

export const updatePart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: req.params.id, account_id: account_id };
    if(userRole !== 'admin') {
      match.createdBy = user_id;
    }
    const isDataExists = await getAll(match);
    if (!isDataExists || isDataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updateById(req.params.id, req.body, user_id);
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error: any) {
    next(error);
  }
}

export const removePart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(!req.params.id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: req.params.id, account_id: account_id };
    if(userRole !== 'admin') {
      match.createdBy = user_id;
    }
    const isDataExists = await getAll(match);
    if (!isDataExists || isDataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await removeById(req.params.id, user_id);
    res.status(200).json({ status: true, message: "Data deleted successfully", data });
  } catch (error: any) {
    next(error);
  }
}