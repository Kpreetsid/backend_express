import { controllerCache } from '../../../_cache/controllerCache.service';
import { Request, Response, NextFunction } from 'express';
import { get } from 'lodash';
import { commentService } from './comments.service';
import { IUser } from '../../../models/user.model';
import { helperService } from '../../../utils/helper';
import { applyRoleFilter } from '../../../utils/roleFilter';
import { postService } from '../posts.service';

class CommentController {
  async getAllComments(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const post = await this.assertPostAccess(req, user);
      const data = await commentService.getAllCommentsForPost(user.account_id, post._id);
      res.status(200).json({ status: true, message: 'Comments fetched successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async getCommentById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const post = await this.assertPostAccess(req, user);
      const data = await commentService.getComment(user.account_id, post._id, req.params.id);
      if (!data) throw Object.assign(new Error('Comment not found'), { status: 404 });
      res.status(200).json({ status: true, message: 'Comment fetched successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async createComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const post = await this.assertPostAccess(req, user);
      if (post.commentsEnabled === false) {
        throw Object.assign(new Error('Comments are disabled for this post'), { status: 409 });
      }
      const data = await commentService.createComment(req.body, user.account_id, post._id, user._id);
      const createdData = await commentService.getComment(user.account_id, post._id, data._id);
      res.status(201).json({ status: true, message: 'Comment created successfully', data: createdData });
    } catch (error) {
      next(error);
    }
  }

  async updateComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const post = await this.assertPostAccess(req, user);
      const data = await commentService.updatePostComment(
        user.account_id,
        post._id,
        req.params.id,
        req.body.comments,
        user._id,
        this.canModerate(req, user)
      );
      if (!data) throw Object.assign(new Error('Only the comment author or a post editor can update this comment'), { status: 403 });
      res.status(200).json({ status: true, message: 'Comment updated successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async removeComment(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, 'user', {}) as IUser;
      const post = await this.assertPostAccess(req, user);
      const data = await commentService.removePostComment(
        user.account_id,
        post._id,
        req.params.id,
        user._id,
        this.canModerate(req, user)
      );
      if (!data) throw Object.assign(new Error('Only the comment author or a post editor can delete this comment'), { status: 403 });
      res.status(200).json({ status: true, message: 'Comment deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  private async assertPostAccess(req: Request, user: IUser): Promise<any> {
    const baseFilter = { _id: helperService.validateObjectId(String(req.params.postId)) };
    const filter = await applyRoleFilter({
      user,
      baseFilter,
      accountField: 'account_id',
      createdByField: 'createdBy'
    });
    const scopedFilter = await postService.applyAudienceScope(filter, user, this.canModerate(req, user));
    const post = await postService.findAccessiblePost(scopedFilter, user.account_id);
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
    return post;
  }

  private canModerate(req: Request, user: IUser): boolean {
    return user.user_role === 'admin' || Boolean(get(req, 'role.posts.edit'));
  }
}

export const commentController = controllerCache.withCache(new CommentController(), { namespace: 'post-comments', ttlSeconds: 300, tags: ['posts', 'users'] });
