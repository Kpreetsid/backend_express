import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { postService } from './posts.service';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';

class PostController {

  async getPosts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const baseFilter: any = { account_id, visible: true };
      const { query: { postType, relatedTo } } = req;
      if (postType) {
        baseFilter.postType = postType.toString().split(',');
      }
      if (relatedTo) {
        baseFilter.relatedTo = relatedTo.toString().split(',');
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        createdByField: "userId"
      });
      const data = await postService.getAllParts(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async getPost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const { account_id } = user;
      const { id } = req.params;
      const baseFilter: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id };
      const { postType, relatedTo } = req.query;
      if (postType) {
        baseFilter.postType = postType.toString().split(',');
      }
      if (relatedTo) {
        baseFilter.relatedTo = relatedTo.toString().split(',');
      }
      const filter = await applyRoleFilter({
        user,
        baseFilter,
        accountField: "account_id",
        createdByField: "userId"
      });
      const data = await postService.getAllParts(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async createPost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
      console.log({ account_id, user_id, userRole });
      await postService.insert(req, res, next);
    } catch (error) {
      next(error);
    }
  }

  async updatePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id };
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

  async removePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id };
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