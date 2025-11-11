import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { getAllParts, insert, updatePartById, removeById, updatePartStock } from './parts.service';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

export const getParts = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { account_id, visible: true };
    const { query: { id } } = req;
    if (id) {
      match._id = { $in: id.toString().split(',').map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
    const data = await getAllParts(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const getPart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, visible: true };
    const data = await getAllParts(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
}

export const createPart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const data = await insert(req.body, account_id, user_id);
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const updatePart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body } = req;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, visible: true };
    const isDataExists = await getAllParts(match);
    if (!isDataExists || isDataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await updatePartById(id, body, user_id);
    if(!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
}

export const updateStock = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id }, body: { quantity, part_number } } = req;
     if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const part = await getAllParts({ _id: new mongoose.Types.ObjectId(id), account_id, visible: true });
    if (!part || part.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    if (part[0].part_number !== part_number) {
      throw Object.assign(new Error('Part number does not match'), { status: 400 });
    }
    part[0].quantity = Number(part[0].quantity) + Number(quantity);
    const updatedPart = await updatePartStock(id, part[0], user_id);
    if(!updatedPart) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data updated successfully", data: updatedPart });
  } catch (error) {
    next(error);
  }
};

export const removePart = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('Bad request'), { status: 400 });
    }
    const match: any = { _id: new mongoose.Types.ObjectId(id), account_id, visible: true };
    const isDataExists = await getAllParts(match);
    if (!isDataExists || isDataExists.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await removeById(id, user_id);
    if(!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}