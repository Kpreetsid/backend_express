import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsModel } from '../../../models/comment.model';
import { PostModel } from '../../../models/post.model';
import { commentService } from './comments.service';

const commentModelMocks = vi.hoisted(() => ({
  save: vi.fn(),
  find: vi.fn(),
  exists: vi.fn(),
  findOneAndUpdate: vi.fn()
}));
const postModelMocks = vi.hoisted(() => ({ exists: vi.fn() }));

vi.mock('../../../models/comment.model', () => {
  const CommentsModelMock: any = vi.fn(function (this: any, body: any) {
    Object.assign(this, body);
    this.save = commentModelMocks.save;
  });
  CommentsModelMock.find = commentModelMocks.find;
  CommentsModelMock.exists = commentModelMocks.exists;
  CommentsModelMock.findOneAndUpdate = commentModelMocks.findOneAndUpdate;
  return { CommentsModel: CommentsModelMock };
});
vi.mock('../../../models/post.model', () => ({
  PostModel: { exists: postModelMocks.exists }
}));

function queryFor(items: any[]) {
  const populated = {
    lean: vi.fn().mockResolvedValue(items)
  };
  return {
    populate: vi.fn().mockReturnValue(populated),
    lean: vi.fn().mockResolvedValue(items),
    sort: vi.fn().mockResolvedValue(items)
  };
}

describe('post-comment service tenant boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const postId = '507f1f77bcf86cd799439013';
  const commentId = '507f1f77bcf86cd799439014';

  beforeEach(() => {
    vi.clearAllMocks();
    postModelMocks.exists.mockResolvedValue({ _id: postId });
    commentModelMocks.exists.mockResolvedValue({ _id: commentId });
  });

  it('returns an empty tenant-scoped top-level comment list', async () => {
    commentModelMocks.find.mockReturnValue(queryFor([]));

    await expect(commentService.getAllCommentsForPost({
      account_id: accountId,
      post_id: postId
    })).resolves.toEqual([]);

    expect(commentModelMocks.find).toHaveBeenCalledWith({
      account_id: accountId,
      post_id: postId,
      visible: true,
      parentCommentId: null
    });
  });

  it('recursively loads replies without leaving tenant or post scope', async () => {
    const root = { _id: commentId, comments: 'Root' };
    const child = { _id: '507f1f77bcf86cd799439015', comments: 'Child' };
    commentModelMocks.find
      .mockReturnValueOnce(queryFor([root]))
      .mockReturnValueOnce(queryFor([child]))
      .mockReturnValueOnce(queryFor([]));

    const result = await commentService.getAllCommentsForPost({
      account_id: accountId,
      post_id: postId
    });

    expect(result[0]).toEqual(expect.objectContaining({
      id: commentId,
      replies: [
        expect.objectContaining({
          id: child._id,
          replies: []
        })
      ]
    }));
    expect(commentModelMocks.find).toHaveBeenNthCalledWith(2, {
      parentCommentId: commentId,
      account_id: accountId,
      post_id: postId,
      visible: true
    });
    expect(commentModelMocks.find).toHaveBeenNthCalledWith(3, {
      parentCommentId: child._id,
      account_id: accountId,
      post_id: postId,
      visible: true
    });
  });

  it('keeps generic reads and their established empty-result error scoped', async () => {
    commentModelMocks.find
      .mockReturnValueOnce(queryFor([]))
      .mockReturnValueOnce(queryFor([{ _id: commentId }]));

    await expect(commentService.getAllComments({
      account_id: accountId,
      post_id: postId
    })).rejects.toMatchObject({
      status: 404,
      message: 'No records found'
    });
    await expect(commentService.getComments({
      account_id: accountId,
      post_id: postId
    })).resolves.toEqual([{ _id: commentId }]);
  });

  it('maps successful generic reads with tenant-scoped nested replies', async () => {
    const root = { _id: commentId, comments: 'Root' };
    commentModelMocks.find
      .mockReturnValueOnce(queryFor([root]))
      .mockReturnValueOnce(queryFor([]));

    await expect(commentService.getAllComments({
      account_id: accountId,
      post_id: postId
    })).resolves.toEqual([
      expect.objectContaining({
        id: commentId,
        replies: []
      })
    ]);

    expect(commentModelMocks.find).toHaveBeenNthCalledWith(2, {
      parentCommentId: commentId,
      account_id: accountId,
      post_id: postId,
      visible: true
    });
  });

  it('rejects creation when the route post is outside the tenant', async () => {
    postModelMocks.exists.mockResolvedValue(null);

    await expect(commentService.createComment({
      post_id: postId,
      comments: 'New comment'
    }, accountId, userId)).rejects.toMatchObject({
      status: 404,
      message: 'Post not found'
    });
    expect(CommentsModel).not.toHaveBeenCalled();
  });

  it('rejects a parent comment outside the tenant post', async () => {
    commentModelMocks.exists.mockResolvedValue(null);

    await expect(commentService.createComment({
      post_id: postId,
      parentCommentId: commentId,
      comments: 'Reply'
    }, accountId, userId)).rejects.toMatchObject({
      status: 404,
      message: 'Parent comment not found'
    });
    expect(commentModelMocks.exists).toHaveBeenCalledWith({
      _id: commentId,
      account_id: accountId,
      post_id: postId,
      visible: true
    });
  });

  it('creates a root or verified reply with server-owned scope', async () => {
    const saved = { _id: commentId };
    commentModelMocks.save.mockResolvedValue(saved);

    await expect(commentService.createComment({
      post_id: postId,
      parentCommentId: commentId,
      comments: 'Reply'
    }, accountId, userId)).resolves.toBe(saved);

    expect(PostModel.exists).toHaveBeenCalledWith({
      _id: postId,
      account_id: accountId,
      visible: true
    });
    expect(CommentsModel).toHaveBeenCalledWith({
      account_id: accountId,
      post_id: postId,
      comments: 'Reply',
      parentCommentId: commentId,
      createdBy: userId
    });
  });

  it('updates only a visible comment matching the caller-owned scope', async () => {
    commentModelMocks.findOneAndUpdate.mockResolvedValue({ _id: commentId });
    const match = {
      _id: commentId,
      post_id: postId,
      account_id: accountId
    };

    await commentService.updateComment(match, 'Updated', userId);

    expect(commentModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { ...match, visible: true },
      { comments: 'Updated', updatedBy: userId },
      { returnDocument: 'after' }
    );
  });

  it('fails closed when scoped deletion cannot find the comment', async () => {
    commentModelMocks.findOneAndUpdate.mockResolvedValue(null);

    await expect(commentService.removeComment({
      _id: commentId,
      post_id: postId,
      account_id: accountId
    }, userId)).rejects.toMatchObject({
      status: 404,
      message: 'Comment not found'
    });
  });

  it('soft deletes descendants only within the deleted tenant post', async () => {
    const childId = '507f1f77bcf86cd799439015';
    commentModelMocks.findOneAndUpdate
      .mockResolvedValueOnce({
        _id: commentId,
        account_id: accountId,
        post_id: postId
      })
      .mockResolvedValueOnce({ _id: childId });
    commentModelMocks.find
      .mockReturnValueOnce(queryFor([{ _id: childId }]))
      .mockReturnValueOnce(queryFor([]));

    await commentService.removeComment({
      _id: commentId,
      post_id: postId,
      account_id: accountId
    }, userId);

    expect(commentModelMocks.find).toHaveBeenNthCalledWith(1, {
      parentCommentId: commentId,
      account_id: accountId,
      post_id: postId,
      visible: true
    });
    expect(commentModelMocks.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: childId, account_id: accountId, post_id: postId, visible: true },
      { visible: false, updatedBy: userId },
      { returnDocument: 'after' }
    );
  });
});
