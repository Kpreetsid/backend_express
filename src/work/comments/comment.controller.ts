import { Request, Response, NextFunction } from 'express';
import { getAllComments, updateComment, removeComment, createComment } from './comment.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';
import mongoose from 'mongoose';

export const getAll = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { params: { id: orderId } } = req;
    if (!orderId) {
      throw Object.assign(new Error('Order ID is required'), { status: 400 });
    }
    const match : any = { account_id: account_id, order_id: new mongoose.Types.ObjectId(orderId) };
    if(userRole !== "admin") {
      match.createdBy = user_id;
    }
    const data = await getAllComments(match);
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
    const { params: { id: orderId, commentId } } = req;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw Object.assign(new Error('Invalid order ID'), { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      throw Object.assign(new Error('Invalid comment ID'), { status: 400 });
    }
    const match : any = { account_id: account_id, order_id: new mongoose.Types.ObjectId(orderId), _id: new mongoose.Types.ObjectId(commentId) };
    if(userRole !== "admin") {
      match.createdBy = user_id;
    }
    const data = await getAllComments(match);
    if (!data) {
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
    const { params: { id: orderId }, body } = req;
    if (!orderId) {
      throw Object.assign(new Error('Order ID is required'), { status: 400 });
    }
    if (body.parentCommentId) {
      body.parentCommentId = new mongoose.Types.ObjectId(body.parentCommentId);
    }
    body.order_id = orderId;
    const data = await createComment(body, account_id, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const result = await getAllComments({ _id: data._id, parentCommentId: data.parentCommentId, account_id: account_id, order_id: new mongoose.Types.ObjectId(orderId) });
    res.status(201).json({ status: true, message: "Data created successfully", data: result[0] });
  } catch (error) {
    next(error);
  }
}

export const update = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id: orderId, commentId }, body } = req;
    if (!orderId) {
      throw Object.assign(new Error('Order ID is required'), { status: 400 });
    }
    if (!commentId) {
      throw Object.assign(new Error('Comment ID is required'), { status: 400 });
    }
    const existingComment = await getAllComments({ _id: commentId, account_id: account_id, order_id: new mongoose.Types.ObjectId(orderId) });
    if (!existingComment) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    body.order_id = orderId;
    const data = await updateComment(commentId, body.comments, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    next(error);
  }
}

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const { params: { id: orderId, commentId } } = req;
    if (!orderId) {
      throw Object.assign(new Error('Order ID is required'), { status: 400 });
    }
    if (!commentId) {
      throw Object.assign(new Error('Comment ID is required'), { status: 400 });
    }
    console.log({ _id: new mongoose.Types.ObjectId(commentId), account_id: account_id, order_id: new mongoose.Types.ObjectId(orderId), visible: true });
    const existingComment = await getAllComments({ _id: new mongoose.Types.ObjectId(commentId), account_id: account_id, order_id: new mongoose.Types.ObjectId(orderId), visible: true });
    if (!existingComment) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data = await removeComment(commentId, user_id);
    if (!data) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    next(error);
  }
}