import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { createInstructions, deleteInstructionsById, getInstructions, updateInstructions } from './instruction.service';
import mongoose from 'mongoose';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    const data: any[] = await getInstructions(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getDataById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id, visible: true };
    const data = await getInstructions(match);
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
    const data = await createInstructions(body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id, visible: true };
    const existingRequest = await getInstructions(match);
    if (!existingRequest || existingRequest.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updateInstructions(id, body, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

  } catch (error) {
    next(error);
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id: account_id, visible: true };
    const existingRequest = await getInstructions(match);
    if (!existingRequest || existingRequest.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await deleteInstructionsById(id, user_id);
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}