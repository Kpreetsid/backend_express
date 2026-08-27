import { controllerCache } from '../../_cache/controllerCache.service';

import { Request, Response, NextFunction } from 'express';
import { commentService } from './comment.service';
import { IUser } from '../../models/user.model';
import { get } from 'lodash';
import { helperService } from '../../utils/helper';
import { WorkOrderModel } from '../../models/workOrder.model';

class CommentController {

  private async assertOrderInAccount(orderId: any, account_id: any): Promise<void> {
    const order = await WorkOrderModel.exists({ _id: orderId, account_id, visible: true });
    if (!order) throw Object.assign(new Error('Work order not found'), { status: 404 });
  }


  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id: orderId } } = req;
      if (!orderId) {
        throw Object.assign(new Error('Order ID is required'), { status: 400 });
      }
      const match: any = { account_id: account_id, order_id: helperService.validateObjectId(orderId), visible: true };
      await this.assertOrderInAccount(match.order_id, account_id);
      const data = await commentService.getAllCommentsForWorkOrder(match);
      res.status(200).json({ status: true, message: "Comments fetched successfully.", data });

    } catch (error) {
      next(error);
    }
  }

  async getDataById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id: orderId, commentId } } = req;
      const orderObjectId = helperService.validateObjectId(orderId);
      const commentObjectId = helperService.validateObjectId(commentId);
      await this.assertOrderInAccount(orderObjectId, account_id);
      const match: any = { account_id: account_id, order_id: orderObjectId, _id: commentObjectId, visible: true };
      const data = await commentService.getComments(match);
      if (data.length === 0) {
        throw Object.assign(new Error('Comment not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Comment fetched successfully.", data: data[0] });
    } catch (error) {
      next(error);
    }
  }


  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id: orderId }, body } = req;
      if (!orderId) {
        throw Object.assign(new Error('Order ID is required'), { status: 400 });
      }
      if (body.parentCommentId) {
        body.parentCommentId = helperService.validateObjectId(String(body.parentCommentId));
      }
      body.order_id = helperService.validateObjectId(String(orderId));
      await this.assertOrderInAccount(body.order_id, account_id);
      if (body.parentCommentId) {
        const parent = await commentService.getComments({
          _id: body.parentCommentId,
          account_id,
          order_id: body.order_id,
          visible: true
        });
        if (parent.length === 0) {
          throw Object.assign(new Error('Parent comment not found'), { status: 404 });
        }
      }
      const data = await commentService.createComment(body, account_id, user);
      if (!data) {
        throw Object.assign(new Error('Comment not created'), { status: 404 });
      }
      const result = await commentService.getAllComments({ _id: data._id, parentCommentId: data.parentCommentId, account_id: account_id, order_id: helperService.validateObjectId(orderId) });
      res.status(201).json({ status: true, message: "Comment created.", data: result[0] });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id: orderId, commentId }, body } = req;
      if (!orderId) {
        throw Object.assign(new Error('Order ID is required'), { status: 400 });
      }
      if (!commentId) {
        throw Object.assign(new Error('Comment ID is required'), { status: 400 });
      }
      const existingComment = await commentService.getComments({ _id: helperService.validateObjectId(commentId), account_id: account_id, order_id: helperService.validateObjectId(orderId), visible: true });
      if (!existingComment || existingComment.length === 0) {
        throw Object.assign(new Error('Comment not found'), { status: 404 });
      }

      const ownershipMatch = user.user_role === 'admin' ? {} : { createdBy: user._id };
      const data = await commentService.updateComment({
        _id: helperService.validateObjectId(commentId),
        account_id,
        order_id: helperService.validateObjectId(orderId),
        ...ownershipMatch
      }, body.comments, user);
      if (!data) {
        throw Object.assign(new Error('Only the comment author or an administrator can update this comment'), { status: 403 });
      }
      res.status(201).json({ status: true, message: "Comment updated successfully.", data });
    } catch (error) {
      next(error);
    }
  }


  async remove(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { params: { id: orderId, commentId } } = req;
      if (!orderId) {
        throw Object.assign(new Error('Order ID is required'), { status: 400 });
      }
      if (!commentId) {
        throw Object.assign(new Error('Comment ID is required'), { status: 400 });
      }
      const existingComment = await commentService.getComments({ _id: helperService.validateObjectId(commentId), account_id: account_id, order_id: helperService.validateObjectId(orderId), visible: true });
      if (!existingComment || existingComment.length === 0) {
        throw Object.assign(new Error('Comment not found'), { status: 404 });
      }

      const ownershipMatch = user.user_role === 'admin' ? {} : { createdBy: user._id };
      const data = await commentService.removeComment({
        _id: helperService.validateObjectId(commentId),
        account_id,
        order_id: helperService.validateObjectId(orderId),
        ...ownershipMatch
      }, user);
      if (!data) {
        throw Object.assign(new Error('Only the comment author or an administrator can delete this comment'), { status: 403 });
      }
      res.status(200).json({ status: true, message: "Comment deleted successfully." });
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = controllerCache.withCache(new CommentController(), { namespace: 'work-comments', ttlSeconds: 120, tags: ['work-orders'] });

