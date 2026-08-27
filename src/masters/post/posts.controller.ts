<<<<<<< Updated upstream
import { controllerCache } from '../../_cache/controllerCache.service';
=======
>>>>>>> Stashed changes
import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { postService } from './posts.service';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';
<<<<<<< Updated upstream

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
=======
import { POST_TOPICS, POST_TYPES } from './post.policy';

class PostController {
  async getPosts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const filter = await this.buildReadFilter(req, user);
      const data = await postService.getAllPosts(filter, user.account_id);
      res.status(200).json({ status: true, message: 'Posts fetched successfully', data });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async getPost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
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
=======
      const user = get(req, 'user', {}) as IUser;
      const filter = await this.buildReadFilter(req, user, helperService.validateObjectId(String(req.params.id)));
      const data = await postService.getAllPosts(filter, user.account_id);
      if (!data.length) throw Object.assign(new Error('Post not found'), { status: 404 });
      res.status(200).json({ status: true, message: 'Post fetched successfully', data: data[0] });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async createPost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
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
=======
      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const data = await postService.insertPost(req.body, account_id, userId);
      const createdData = await postService.getAllPosts({ _id: data._id, visible: true }, account_id);
      if (!createdData.length) throw Object.assign(new Error('Post not found'), { status: 404 });
      res.status(201).json({ status: true, message: 'Post created successfully', data: createdData[0] });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async updatePost(req: Request, res: Response, next: NextFunction): Promise<any> {
<<<<<<< Updated upstream
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
=======
    return this.update(req, res, next, false);
  }

  async partialUpdatePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    return this.update(req, res, next, true);
>>>>>>> Stashed changes
  }

  async removePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
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
=======
      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const result = await postService.removePostById(req.params.id, account_id, userId);
      if (!result) throw Object.assign(new Error('Post not found'), { status: 404 });
      res.status(200).json({ status: true, message: 'Post deleted successfully' });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async likePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const result = await postService.likePost(helperService.validateObjectId(String(id)), user_id);
      res.status(200).json({ status: true, message: "Post like updated successfully", data: result });
=======
      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const result = await postService.likePost(req.params.id, account_id, userId);
      res.status(200).json({ status: true, message: 'Post like updated successfully', data: result });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }

  async dislikePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
<<<<<<< Updated upstream
      const { _id: user_id } = get(req, "user", {}) as IUser;
      const { id } = req.params;
      const result = await postService.dislikePost(helperService.validateObjectId(String(id)), user_id);
      res.status(200).json({ status: true, message: "Post dislike updated successfully", data: result });
=======
      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const result = await postService.dislikePost(req.params.id, account_id, userId);
      res.status(200).json({ status: true, message: 'Post dislike updated successfully', data: result });
>>>>>>> Stashed changes
    } catch (error) {
      next(error);
    }
  }
<<<<<<< Updated upstream
}

export const postController = controllerCache.withCache(new PostController(), { namespace: 'posts', ttlSeconds: 300, tags: ['posts', 'users'] });
=======

  private async update(req: Request, res: Response, next: NextFunction, partial: boolean): Promise<any> {
    try {
      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const id = helperService.validateObjectId(String(req.params.id));
      const result = await postService.updatePostById(id, req.body, account_id, userId, { partial });
      if (!result) throw Object.assign(new Error('Post not found'), { status: 404 });
      const updatedData = await postService.getAllPosts({ _id: id, visible: true }, account_id);
      if (!updatedData.length) throw Object.assign(new Error('Post not found'), { status: 404 });
      res.status(200).json({ status: true, message: 'Post updated successfully', data: updatedData[0] });
    } catch (error) {
      next(error);
    }
  }

  private async buildReadFilter(req: Request, user: IUser, id?: any): Promise<Record<string, any>> {
    const baseFilter: Record<string, any> = id ? { _id: id } : {};
    const postTypes = parseEnumFilter(req.query.postType, POST_TYPES, 'post type');
    const relatedTo = parseEnumFilter(req.query.relatedTo, POST_TOPICS, 'related to');
    if (postTypes.length) baseFilter.postType = { $in: postTypes };
    if (relatedTo.length) baseFilter.relatedTo = { $in: relatedTo };
    const roleFilter = await applyRoleFilter({
      user,
      baseFilter,
      accountField: 'account_id',
      createdByField: 'createdBy'
    });
    const canManage = user.user_role === 'admin' || Boolean(get(req, 'role.posts.edit'));
    return await postService.applyAudienceScope(roleFilter, user, canManage);
  }
}

function parseEnumFilter<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number][] {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value.flatMap(item => String(item).split(',')) : String(value).split(',');
  if (raw.length > 20) throw Object.assign(new Error(`Too many ${label} filters`), { status: 400 });
  const normalized = Array.from(new Set(raw.map(item => item.trim()).filter(Boolean)));
  if (normalized.some(item => !allowed.includes(item as T[number]))) {
    throw Object.assign(new Error(`Invalid ${label} filter`), { status: 400 });
  }
  return normalized as T[number][];
}

export const postController = new PostController();
>>>>>>> Stashed changes
