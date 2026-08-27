import { controllerCache } from '../../_cache/controllerCache.service';


import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { postService } from './posts.service';
import { IUser } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { applyRoleFilter } from '../../utils/roleFilter';

import { POST_TOPICS, POST_TYPES } from './post.policy';

class PostController {
  async getPosts(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const filter = await this.buildReadFilter(req, user);
      const data = await postService.getAllPosts(filter, user.account_id);
      res.status(200).json({ status: true, message: 'Posts fetched successfully', data });

    } catch (error) {
      next(error);
    }
  }

  async getPost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {

      const user = get(req, 'user', {}) as IUser;
      const filter = await this.buildReadFilter(req, user, helperService.validateObjectId(String(req.params.id)));
      const data = await postService.getAllPosts(filter, user.account_id);
      if (!data.length) throw Object.assign(new Error('Post not found'), { status: 404 });
      res.status(200).json({ status: true, message: 'Post fetched successfully', data: data[0] });

    } catch (error) {
      next(error);
    }
  }

  async createPost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {

      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const data = await postService.insertPost(req.body, account_id, userId);
      const createdData = await postService.getAllPosts({ _id: data._id, visible: true }, account_id);
      if (!createdData.length) throw Object.assign(new Error('Post not found'), { status: 404 });
      res.status(201).json({ status: true, message: 'Post created successfully', data: createdData[0] });

    } catch (error) {
      next(error);
    }
  }

  async updatePost(req: Request, res: Response, next: NextFunction): Promise<any> {

    return this.update(req, res, next, false);
  }

  async partialUpdatePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    return this.update(req, res, next, true);

  }

  async removePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {

      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const result = await postService.removePostById(req.params.id, account_id, userId);
      if (!result) throw Object.assign(new Error('Post not found'), { status: 404 });
      res.status(200).json({ status: true, message: 'Post deleted successfully' });

    } catch (error) {
      next(error);
    }
  }

  async likePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {

      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const result = await postService.likePost(req.params.id, account_id, userId);
      res.status(200).json({ status: true, message: 'Post like updated successfully', data: result });

    } catch (error) {
      next(error);
    }
  }

  async dislikePost(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {

      const { account_id, _id: userId } = get(req, 'user', {}) as IUser;
      const result = await postService.dislikePost(req.params.id, account_id, userId);
      res.status(200).json({ status: true, message: 'Post dislike updated successfully', data: result });

    } catch (error) {
      next(error);
    }
  }


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

export const postController = controllerCache.withCache(new PostController(), { namespace: 'posts', ttlSeconds: 300, tags: ['posts', 'users'] });

