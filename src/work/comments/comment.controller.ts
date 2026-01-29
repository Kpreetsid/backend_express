import { Request, Response, NextFunction } from 'express';
import { commentService } from './comment.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';
import { helperService } from '../../util/helper';

class CommentController {

  async getAll (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id: orderId } } = req;
      if (!orderId) {
        throw Object.assign(new Error('Order ID is required'), { status: 400 });
      }
      const match : any = { account_id: account_id, order_id: helperService.validateObjectId(orderId), visible: true };
      const data = await commentService.getAllComments(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async getDataById (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id: orderId, commentId } } = req;
      const orderObjectId = helperService.validateObjectId(orderId);
      const commentObjectId = helperService.validateObjectId(commentId);
      const match : any = { account_id: account_id, order_id: orderObjectId, _id: commentObjectId, visible: true };
      const data = await commentService.getAllComments(match);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async create (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id: orderId }, body } = req;
      if (!orderId) {
        throw Object.assign(new Error('Order ID is required'), { status: 400 });
      }
      if (body.parentCommentId) {
        body.parentCommentId = helperService.validateObjectId(body.parentCommentId);
      }
      body.order_id = orderId;
      const data = await commentService.createComment(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const result = await commentService.getAllComments({ _id: data._id, parentCommentId: data.parentCommentId, account_id: account_id, order_id: helperService.validateObjectId(orderId) });
      res.status(201).json({ status: true, message: "Data created successfully", data: result[0] });
    } catch (error) {
      next(error);
    }
  }
  
  async update (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id: orderId, commentId }, body } = req;
      if (!orderId) {
        throw Object.assign(new Error('Order ID is required'), { status: 400 });
      }
      if (!commentId) {
        throw Object.assign(new Error('Comment ID is required'), { status: 400 });
      }
      const existingComment = await commentService.getAllComments({ _id: helperService.validateObjectId(commentId), account_id: account_id, order_id: helperService.validateObjectId(orderId), visible: true });
      if (!existingComment) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      body.order_id = orderId;
      const data = await commentService.updateComment(String(commentId), body.comments, user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async remove (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id: orderId, commentId } } = req;
      if (!orderId) {
        throw Object.assign(new Error('Order ID is required'), { status: 400 });
      }
      if (!commentId) {
        throw Object.assign(new Error('Comment ID is required'), { status: 400 });
      }
      const existingComment = await commentService.getComments({ _id: helperService.validateObjectId(commentId), account_id: account_id, order_id: helperService.validateObjectId(orderId), visible: true });
      if (!existingComment) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const data = await commentService.removeComment(String(commentId), user_id);
      if (!data) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = new CommentController();