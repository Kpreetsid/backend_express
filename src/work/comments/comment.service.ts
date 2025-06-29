import { Comments, IComments } from "../../models/comment.model";
import { Request, Response, NextFunction } from 'express';
import { get } from "lodash";
import { IUser } from "../../models/user.model";
import mongoose from "mongoose";
import { getData } from "../../util/queryBuilder";
import { WorkOrder } from "../../models/workOrder.model";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
     const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const data = await Comments.find({});
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw Object.assign(new Error('ID is required'), { status: 400 });
    }
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { order_id: new mongoose.Types.ObjectId(id) };
    const isOrderExist = await getData(WorkOrder, { filter: { _id: new mongoose.Types.ObjectId(id), account_id: account_id, visible: true } });
    if (!isOrderExist || isOrderExist.length === 0) {
      throw Object.assign(new Error('Work Order not found'), { status: 404 });
    }
    const data = await getData(Comments, { filter: match });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newComment = new Comments(req.body);
    const data = await newComment.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { body } = req;
    const data = await Comments.findByIdAndUpdate(id, body, { new: true });
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Comments.findById(id);
    if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Comments.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};