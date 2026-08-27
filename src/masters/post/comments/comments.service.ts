import { CommentsModel } from '../../../models/comment.model';
import { helperService } from '../../../utils/helper';
import { COMMENT_MAX_LENGTH } from './comments.validator';

const MAX_COMMENT_DEPTH = 8;
const MAX_COMMENTS_PER_POST = 1_000;
const AUTHOR_SELECT = 'id firstName lastName email username user_role user_profile_img user_status';

class CommentService {
  async getAllCommentsForPost(accountId: any, postId: any): Promise<any[]> {
    const comments: any[] = await CommentsModel.find({
      account_id: helperService.validateObjectId(String(accountId)),
      post_id: helperService.validateObjectId(String(postId)),
      visible: true
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(MAX_COMMENTS_PER_POST)
      .populate([{ path: 'createdBy', model: 'Schema_User', select: AUTHOR_SELECT }])
      .lean();
    return this.buildTree(comments);
  }

  async getComment(accountId: any, postId: any, commentId: any): Promise<any> {
    return await CommentsModel.findOne({
      _id: helperService.validateObjectId(String(commentId)),
      account_id: helperService.validateObjectId(String(accountId)),
      post_id: helperService.validateObjectId(String(postId)),
      visible: true
    }).populate([{ path: 'createdBy', model: 'Schema_User', select: AUTHOR_SELECT }]).lean();
  }

  async createComment(body: any, accountId: any, postId: any, userId: any): Promise<any> {
    const message = this.normalizeMessage(body?.comments);
    const accountObjectId = helperService.validateObjectId(String(accountId));
    const postObjectId = helperService.validateObjectId(String(postId));
    const parentCommentId = body?.parentCommentId
      ? helperService.validateObjectId(String(body.parentCommentId))
      : null;
    if (parentCommentId) await this.assertParent(accountObjectId, postObjectId, parentCommentId);

    const newComment = new CommentsModel({
      account_id: accountObjectId,
      post_id: postObjectId,
      comments: message,
      parentCommentId,
      createdBy: helperService.validateObjectId(String(userId))
    });
    return await newComment.save();
  }

  async updatePostComment(accountId: any, postId: any, commentId: any, message: unknown, userId: any, canModerate: boolean): Promise<any> {
    const filter: Record<string, any> = {
      _id: helperService.validateObjectId(String(commentId)),
      account_id: helperService.validateObjectId(String(accountId)),
      post_id: helperService.validateObjectId(String(postId)),
      visible: true
    };
    if (!canModerate) filter.createdBy = helperService.validateObjectId(String(userId));
    return await CommentsModel.findOneAndUpdate(
      filter,
      { $set: { comments: this.normalizeMessage(message), updatedBy: helperService.validateObjectId(String(userId)) } },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async removePostComment(accountId: any, postId: any, commentId: any, userId: any, canModerate: boolean): Promise<any> {
    const accountObjectId = helperService.validateObjectId(String(accountId));
    const postObjectId = helperService.validateObjectId(String(postId));
    const commentObjectId = helperService.validateObjectId(String(commentId));
    const userObjectId = helperService.validateObjectId(String(userId));
    const filter: Record<string, any> = {
      _id: commentObjectId,
      account_id: accountObjectId,
      post_id: postObjectId,
      visible: true
    };
    if (!canModerate) filter.createdBy = userObjectId;
    const deleted = await CommentsModel.findOneAndUpdate(
      filter,
      { $set: { visible: false, updatedBy: userObjectId } },
      { returnDocument: 'after' }
    );
    if (!deleted) return null;
    await this.softDeleteDescendants(accountObjectId, postObjectId, commentObjectId, userObjectId);
    return deleted;
  }

  private async assertParent(accountId: any, postId: any, parentId: any): Promise<void> {
    let currentId: any = parentId;
    for (let depth = 0; depth < MAX_COMMENT_DEPTH; depth += 1) {
      const parent: any = await CommentsModel.findOne({
        _id: currentId,
        account_id: accountId,
        post_id: postId,
        visible: true
      }).select('parentCommentId').lean();
      if (!parent) throw Object.assign(new Error('Parent comment not found'), { status: 400 });
      if (!parent.parentCommentId) return;
      currentId = parent.parentCommentId;
    }
    throw Object.assign(new Error(`Comment replies cannot exceed ${MAX_COMMENT_DEPTH} levels`), { status: 400 });
  }

  private async softDeleteDescendants(accountId: any, postId: any, commentId: any, userId: any): Promise<void> {
    const result: any[] = await CommentsModel.aggregate([
      { $match: { _id: commentId, account_id: accountId, post_id: postId } },
      {
        $graphLookup: {
          from: CommentsModel.collection.name,
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parentCommentId',
          as: 'descendants',
          maxDepth: MAX_COMMENT_DEPTH - 1,
          restrictSearchWithMatch: { account_id: accountId, post_id: postId, visible: true }
        }
      },
      { $project: { descendantIds: '$descendants._id' } }
    ]);
    const descendantIds = result[0]?.descendantIds || [];
    if (!descendantIds.length) return;
    await CommentsModel.updateMany(
      { _id: { $in: descendantIds }, account_id: accountId, post_id: postId, visible: true },
      { $set: { visible: false, updatedBy: userId } }
    );
  }

  private buildTree(rows: any[]): any[] {
    const byParent = new Map<string, any[]>();
    const knownIds = new Set(rows.map(row => String(row._id)));
    for (const row of rows) {
      const parentKey = row.parentCommentId && knownIds.has(String(row.parentCommentId))
        ? String(row.parentCommentId)
        : '';
      const siblings = byParent.get(parentKey) || [];
      siblings.push(row);
      byParent.set(parentKey, siblings);
    }

    const expand = (row: any, depth: number, path: Set<string>): any => {
      const id = String(row._id);
      const nextPath = new Set(path).add(id);
      const children = depth >= MAX_COMMENT_DEPTH
        ? []
        : (byParent.get(id) || []).filter(child => !nextPath.has(String(child._id)));
      return {
        ...row,
        id: row._id,
        replies: children.map(child => expand(child, depth + 1, nextPath))
      };
    };
    return (byParent.get('') || []).map(row => expand(row, 1, new Set<string>()));
  }

  private normalizeMessage(value: unknown): string {
    if (typeof value !== 'string') throw Object.assign(new Error('Comment must be a string'), { status: 400 });
    const message = value.trim();
    if (!message) throw Object.assign(new Error('Comment text is required'), { status: 400 });
    if (message.length > COMMENT_MAX_LENGTH) {
      throw Object.assign(new Error(`Comment must not exceed ${COMMENT_MAX_LENGTH} characters`), { status: 400 });
    }
    return message;
  }
}

export const commentService = new CommentService();
