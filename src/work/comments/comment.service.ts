import { Comments } from "../../models/comment.model";
import { Request, Response, NextFunction } from 'express';
import mongoose from "mongoose";
import { WorkOrder } from "../../models/workOrder.model";
import { IUser } from "../../models/user.model";
import { get } from "lodash";

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id } = get(req, "user", {}) as IUser;
    const match : any = { account_id: account_id };
    const data = await Comments.find(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const { account_id } = get(req, "user", {}) as IUser;
    const match: any = { order_id: new mongoose.Types.ObjectId(req.params.id) };
    const isOrderExist = await WorkOrder.find({ _id: new mongoose.Types.ObjectId(req.params.id), account_id: account_id, visible: true });
    if (!isOrderExist || isOrderExist.length === 0) {
      throw Object.assign(new Error('Work Order not found'), { status: 404 });
    }
    const data = await Comments.find(match);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const newComment = new Comments(req.body);
    const data = await newComment.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { body, params: { id } } = req;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await Comments.findByIdAndUpdate(id, body, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.params.id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const data = await Comments.findById(req.params.id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Comments.findByIdAndUpdate(req.params.id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
};