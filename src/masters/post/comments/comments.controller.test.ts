import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commentController } from './comments.controller';
import { commentService } from './comments.service';

vi.mock('./comments.service', () => ({
  commentService: {
    getAllCommentsForPost: vi.fn(),
    getComments: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    removeComment: vi.fn()
  }
}));
vi.mock('../../../utils/helper', () => ({
  helperService: {
    validateObjectId: vi.fn((id: string) => ({ id, toString: () => id }))
  }
}));

describe('post-comment controller tenant boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const postId = '507f1f77bcf86cd799439013';
  const commentId = '507f1f77bcf86cd799439014';

  const response = () => {
    const value: any = { status: vi.fn(), json: vi.fn() };
    value.status.mockReturnValue(value);
    value.json.mockReturnValue(value);
    return value;
  };

  const request = (overrides: Record<string, unknown> = {}) => ({
    user: { _id: userId, account_id: accountId },
    params: { postId },
    body: {},
    ...overrides
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists comments only for the route post and authenticated tenant', async () => {
    vi.mocked(commentService.getAllCommentsForPost).mockResolvedValue([]);
    const res = response();
    const next = vi.fn();

    await commentController.getAllComments(request(), res, next);

    expect(commentService.getAllCommentsForPost).toHaveBeenCalledWith({
      post_id: expect.objectContaining({ id: postId }),
      account_id: accountId
    });
    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message: 'Comments fetched successfully',
      data: []
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('reads a comment with post, tenant, and visibility scope', async () => {
    const comment = { _id: commentId, comments: 'Existing' };
    vi.mocked(commentService.getComments).mockResolvedValue([comment] as never);
    const res = response();
    const next = vi.fn();

    await commentController.getCommentById(request({
      params: { postId, id: commentId }
    }), res, next);

    expect(commentService.getComments).toHaveBeenCalledWith({
      _id: expect.objectContaining({ id: commentId }),
      post_id: expect.objectContaining({ id: postId }),
      account_id: accountId,
      visible: true
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('creates under server-owned post, tenant, and actor fields', async () => {
    const created = { _id: commentId, comments: 'New comment' };
    vi.mocked(commentService.createComment).mockResolvedValue(created as never);
    vi.mocked(commentService.getComments).mockResolvedValue([created] as never);
    const body = {
      comments: 'New comment',
      post_id: '507f1f77bcf86cd799439099'
    };
    const res = response();
    const next = vi.fn();

    await commentController.createComment(request({ body }), res, next);

    expect(commentService.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: 'New comment',
        post_id: expect.objectContaining({ id: postId })
      }),
      accountId,
      userId
    );
    expect(commentService.getComments).toHaveBeenCalledWith({
      _id: commentId,
      post_id: expect.objectContaining({ id: postId }),
      account_id: accountId,
      visible: true
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['updateComment', 'updateComment'],
    ['removeComment', 'removeComment']
  ] as const)('%s passes a tenant-scoped match to the service', async (
    controllerMethod,
    serviceMethod
  ) => {
    vi.mocked(commentService[serviceMethod]).mockResolvedValue({
      _id: commentId,
      comments: 'Updated'
    } as never);
    const res = response();
    const next = vi.fn();

    await commentController[controllerMethod](request({
      params: { postId, id: commentId },
      body: { comments: 'Updated' }
    }), res, next);

    expect(commentService[serviceMethod]).toHaveBeenCalledWith(
      {
        _id: expect.objectContaining({ id: commentId }),
        post_id: expect.objectContaining({ id: postId }),
        account_id: accountId
      },
      ...(serviceMethod === 'updateComment'
        ? ['Updated', userId]
        : [userId])
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns the established not-found error for a cross-tenant-shaped miss', async () => {
    vi.mocked(commentService.getComments).mockResolvedValue([]);
    const res = response();
    const next = vi.fn();

    await commentController.getCommentById(request({
      params: { postId, id: commentId }
    }), res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Comment not found'
    }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('forwards tenant-scoped list errors', async () => {
    const failure = new Error('database unavailable');
    vi.mocked(commentService.getAllCommentsForPost).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await commentController.getAllComments(request(), res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    ['createComment', 'createComment', 'Comment not created'],
    ['updateComment', 'updateComment', 'Comment not updated'],
    ['removeComment', 'removeComment', 'Comment not deleted']
  ] as const)('%s preserves its established mutation-miss error', async (
    controllerMethod,
    serviceMethod,
    message
  ) => {
    vi.mocked(commentService[serviceMethod]).mockResolvedValue(null as never);
    const res = response();
    const next = vi.fn();

    await commentController[controllerMethod](request({
      params: { postId, id: commentId },
      body: { comments: 'Updated' }
    }), res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message
    }));
    expect(res.status).not.toHaveBeenCalled();
  });
});
