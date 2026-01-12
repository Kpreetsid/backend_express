import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { postService } from './posts.service';
import { IUser } from '../../models/user.model';
import mongoose from 'mongoose';

class PostController {

   async getPosts (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id, visible: true };
      const { query: { postType, relatedTo }} = req;
      if (postType) {
        match.postType = postType.toString().split(',');
      }
      if (relatedTo) {
        match.relatedTo = relatedTo.toString().split(',');
      }
      const data = await postService.getAllParts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
   async getPost (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const match: any = { _id: new mongoose.Types.ObjectId(String(id)), account_id: account_id };
      const { postType, relatedTo } = req.query;
      if (postType) {
        match.postType = postType.toString().split(',');
      }
      if (relatedTo) {
        match.relatedTo = relatedTo.toString().split(',');
      }
      if (userRole !== 'admin') {
        match.userId = user_id;
      }
      const data = await postService.getAllParts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
   async createPost (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      console.log({ account_id, user_id, userRole });
      await postService.insert(req, res, next);
    } catch (error) {
      next(error);
    }
  }
  
   async updatePost (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const match: any = { _id: new mongoose.Types.ObjectId(String(id)), account_id: account_id };
      const data = await postService.getAllParts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const result = await postService.updateById(id, body, user_id);
      if (!result) {
        throw Object.assign(new Error('No data updated'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully" });
    } catch (error) {
      next(error);
    }
  }
  
   async removePost (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('Bad request'), { status: 400 });
      }
      const match: any = { _id: new mongoose.Types.ObjectId(String(id)), account_id: account_id };
      const data = await postService.getAllParts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const result = await postService.removeById(id, user_id);
      if (!result) {
        throw Object.assign(new Error('No data deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const postController = new PostController();