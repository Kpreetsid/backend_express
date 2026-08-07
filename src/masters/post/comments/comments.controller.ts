import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { commentService } from './comments.service';
import { IUser } from '../../../models/user.model';
import { helperService } from '../../../utils/helper';

class CommentController {

  async getAllComments(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { postId } = req.params;
      const match = {
        post_id: helperService.validateObjectId(postId),
        account_id
      };
      const data = await commentService.getAllCommentsForPost(match);
      res.status(200).json({ status: true, message: "Comments fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getCommentById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { postId, id } = req.params;
      const data = await commentService.getComments({
        _id: helperService.validateObjectId(id),
        post_id: helperService.validateObjectId(postId),
        account_id,
        visible: true
      });
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Comment not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Comment fetched successfully", data: data[0] });
    } catch (error) {
      next(error);
    }
  }

  async createComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { postId } = req.params;
      const { body } = req;
      body.post_id = helperService.validateObjectId(postId);
      const data = await commentService.createComment(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('Comment not created'), { status: 404 });
      }
      const createdData = await commentService.getComments({
        _id: data._id,
        post_id: body.post_id,
        account_id,
        visible: true
      });
      res.status(201).json({ status: true, message: "Comment created successfully", data: createdData[0] });
    } catch (error) {
      next(error);
    }
  }

  async updateComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { postId, id } = req.params;
      const { comments } = req.body;
      const data = await commentService.updateComment({
        _id: helperService.validateObjectId(id),
        post_id: helperService.validateObjectId(postId),
        account_id
      }, comments, user_id);
      if (!data) {
        throw Object.assign(new Error('Comment not updated'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Comment updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async removeComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { postId, id } = req.params;
      const data = await commentService.removeComment({
        _id: helperService.validateObjectId(id),
        post_id: helperService.validateObjectId(postId),
        account_id
      }, user_id);
      if (!data) {
        throw Object.assign(new Error('Comment not deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Comment deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = new CommentController();
