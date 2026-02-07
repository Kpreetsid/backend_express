import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { commentService } from './comments.service';
import { IUser } from '../../../models/user.model';
import { helperService } from '../../../utils/helper';

class CommentController {

  async getAllComments(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { body } = req;
      const data = await commentService.createComment(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data created'), { status: 404 });
      }
      const createdData = await commentService.getComments({ _id: data._id });
      res.status(201).json({ status: true, message: "Comment created successfully", data: createdData[0] });
    } catch (error) {
      next(error);
    }
  }

  async getCommentById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { postId } = req.params;
      const match = { post_id: helperService.validateObjectId(postId) };
      const data = await commentService.getAllCommentsForPost(match);
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async createComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { body } = req;
      const data = await commentService.createComment(body, account_id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data created'), { status: 404 });
      }
      const createdData = await commentService.getComments({ _id: data._id });
      res.status(201).json({ status: true, message: "Comment created successfully", data: createdData[0] });
    } catch (error) {
      next(error);
    }
  }

  async updateComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const { comments } = req.body;
      const data = await commentService.updateComment(id, comments, user_id);
      if (!data) {
        throw Object.assign(new Error('No data updated'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Comment updated successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async removeComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const data = await commentService.removeComment(id, user_id);
      if (!data) {
        throw Object.assign(new Error('No data deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Comment deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = new CommentController();
