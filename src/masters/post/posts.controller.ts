import { controllerCache } from '../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { postService } from './posts.service';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';

class PostController {

  async getPosts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const baseFilter: any = {};
      const { query: { postType, relatedTo } } = req;
      if (postType) {
        baseFilter.postType = postType.toString().split(',');
      }
      if (relatedTo) {
        baseFilter.relatedTo = relatedTo.toString().split(',');
      }
      const filter = await applyRoleFilter({
        user: get(req, "user", {}) as IUser,
        baseFilter,
        accountField: "account_id",
        createdByField: "createdBy"
      });
      const data = await postService.getAllPosts(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Posts not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Posts fetched successfully", data });
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
      const data = await postService.getAllPosts(filter);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Post fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }

  async createPost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { body } = req;
      const data = await postService.insertPost({ ...body, account_id, createdBy: user_id });
      if (!data) {
        throw Object.assign(new Error('Post not created'), { status: 404 });
      }
      const createdData = await postService.getAllPosts({ _id: data._id, account_id: account_id });
      if (!createdData || createdData.length === 0) {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Post created successfully", data: createdData[0] });
    } catch (error) {
      next(error);
    }
  }

  async updatePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id };
      const data = await postService.getAllPosts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      const result = await postService.updatePostById(helperService.validateObjectId(String(id)), body, user_id);
      if (!result) {
        throw Object.assign(new Error('Post not updated'), { status: 404 });
      }
      const updatedData = await postService.getAllPosts({ _id: helperService.validateObjectId(String(id)), account_id: account_id });
      if (!updatedData || updatedData.length === 0) {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Post updated successfully", data: updatedData[0] });
    } catch (error) {
      next(error);
    }
  }

  async partialUpdatePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id }, body } = req;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id };
      const data = await postService.getAllPosts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      const updatedBody = { ...data[0], ...body };
      const result = await postService.updatePostById(helperService.validateObjectId(String(id)), updatedBody, user_id);
      if (!result) {
        throw Object.assign(new Error('Post not updated'), { status: 404 });
      }
      const updatedData = await postService.getAllPosts({ _id: helperService.validateObjectId(String(id)), account_id: account_id });
      if (!updatedData || updatedData.length === 0) {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Post updated successfully", data: updatedData[0] });
    } catch (error) {
      next(error);
    }
  }

  async removePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const match: any = { _id: helperService.validateObjectId(String(id)), account_id: account_id };
      const data = await postService.getAllPosts(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('Post not found'), { status: 404 });
      }
      const result = await postService.removePostById(helperService.validateObjectId(String(id)), user_id);
      if (!result) {
        throw Object.assign(new Error('Post not deleted'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Post deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  async likePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const result = await postService.likePost(helperService.validateObjectId(String(id)), user_id);
      res.status(200).json({ status: true, message: "Post like updated successfully", data: result });
    } catch (error) {
      next(error);
    }
  }

  async dislikePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const result = await postService.dislikePost(helperService.validateObjectId(String(id)), user_id);
      res.status(200).json({ status: true, message: "Post dislike updated successfully", data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const postController = controllerCache.withCache(new PostController(), { namespace: 'posts', ttlSeconds: 300, tags: ['posts', 'users'] });
