import { Request, Response, NextFunction } from 'express';
import { getSchedules, createSchedules, updateSchedules, removeSchedules } from './schedule.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';
import mongoose from 'mongoose';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { account_id };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    const data = await getSchedules(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getDataById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { id } = req.params;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id };
    if (userRole !== 'admin') {
      match.user_id = user_id;
    }
    const data = await getSchedules(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const create = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const body = req.body;
    const data = await createSchedules(body, account_id, user_id);
    res.status(200).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('Id is required'), { status: 400 });
    }
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const existingData = await getSchedules({ _id: id, account_id: account_id, visible: true });
    if (!existingData || existingData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updateSchedules(id, body, user_id);
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    console.log({ account_id, user_id, userRole });
    const { id } = req.params;
    if (!id) {
      throw Object.assign(new Error('Id is required'), { status: 400 });
    }
    const existingData = await getSchedules({ _id: id, account_id: account_id, visible: true });
    if (!existingData || existingData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await removeSchedules(id, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}