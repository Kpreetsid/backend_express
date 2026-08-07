import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postController } from './posts.controller';
import { postService } from './posts.service';
import { applyRoleFilter } from '../../utils/roleFilter';

vi.mock('./posts.service', () => ({
  postService: {
    getAllPosts: vi.fn(),
    insertPost: vi.fn(),
    updatePostById: vi.fn(),
    removePostById: vi.fn(),
    likePost: vi.fn(),
    dislikePost: vi.fn()
  }
}));
vi.mock('../../utils/roleFilter', () => ({ applyRoleFilter: vi.fn() }));
vi.mock('../../utils/helper', () => ({
  helperService: {
    validateObjectId: vi.fn((id: string) => ({ id, toString: () => id }))
  }
}));

describe('post controller tenant boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const postId = '507f1f77bcf86cd799439013';

  const response = () => {
    const value: any = { status: vi.fn(), json: vi.fn() };
    value.status.mockReturnValue(value);
    value.json.mockReturnValue(value);
    return value;
  };

  const request = (overrides: Record<string, unknown> = {}) => ({
    user: {
      _id: userId,
      account_id: accountId,
      user_role: 'admin'
    },
    params: {},
    query: {},
    body: {},
    ...overrides
  } as any);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(applyRoleFilter).mockImplementation(
      async ({ baseFilter }: any) => ({ ...baseFilter, account_id: accountId })
    );
  });

  it('lists only visible tenant posts with unchanged filters', async () => {
    vi.mocked(postService.getAllPosts).mockResolvedValue([
      { _id: postId, title: 'Pump inspection' }
    ] as never);
    const res = response();
    const next = vi.fn();

    await postController.getPosts(request({
      query: { postType: 'Maintenance,Quality', relatedTo: 'Assets' }
    }), res, next);

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      baseFilter: {
        visible: true,
        postType: ['Maintenance', 'Quality'],
        relatedTo: ['Assets']
      },
      accountField: 'account_id',
      createdByField: 'createdBy'
    }));
    expect(postService.getAllPosts).toHaveBeenCalledWith({
      visible: true,
      postType: ['Maintenance', 'Quality'],
      relatedTo: ['Assets'],
      account_id: accountId
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('reads one post under the authenticated tenant and visibility scope', async () => {
    vi.mocked(postService.getAllPosts).mockResolvedValue([
      { _id: postId, title: 'Pump inspection' }
    ] as never);
    const res = response();
    const next = vi.fn();

    await postController.getPost(request({
      params: { id: postId },
      query: { relatedTo: 'Assets' }
    }), res, next);

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      baseFilter: {
        _id: expect.objectContaining({ id: postId }),
        account_id: accountId,
        visible: true,
        relatedTo: ['Assets']
      },
      createdByField: 'userId'
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('creates with server-owned tenant and actor fields', async () => {
    vi.mocked(postService.insertPost).mockResolvedValue({ _id: postId } as never);
    vi.mocked(postService.getAllPosts).mockResolvedValue([
      { _id: postId, title: 'Pump inspection' }
    ] as never);
    const res = response();
    const next = vi.fn();

    await postController.createPost(request({
      body: {
        title: 'Pump inspection',
        account_id: '507f1f77bcf86cd799439099',
        createdBy: '507f1f77bcf86cd799439098'
      }
    }), res, next);

    expect(postService.insertPost).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Pump inspection',
      account_id: accountId,
      createdBy: userId
    }));
    expect(postService.getAllPosts).toHaveBeenCalledWith({
      _id: postId,
      account_id: accountId
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['updatePost', 'updatePostById'],
    ['partialUpdatePost', 'updatePostById']
  ] as const)('%s passes tenant ownership into the mutation boundary', async (
    controllerMethod,
    serviceMethod
  ) => {
    vi.mocked(postService.getAllPosts)
      .mockResolvedValueOnce([{ _id: postId, title: 'Current' }] as never)
      .mockResolvedValueOnce([{ _id: postId, title: 'Updated' }] as never);
    vi.mocked(postService[serviceMethod]).mockResolvedValue({
      _id: postId,
      title: 'Updated'
    } as never);
    const res = response();
    const next = vi.fn();
    const body = { title: 'Updated' };

    await postController[controllerMethod](
      request({ params: { id: postId }, body }),
      res,
      next
    );

    expect(postService[serviceMethod]).toHaveBeenCalledWith(
      expect.objectContaining({ id: postId }),
      body,
      userId,
      accountId
    );
    expect(postService.getAllPosts).toHaveBeenLastCalledWith({
      _id: expect.objectContaining({ id: postId }),
      account_id: accountId,
      visible: true
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('soft deletes only through the tenant-scoped service mutation', async () => {
    vi.mocked(postService.getAllPosts).mockResolvedValue([
      { _id: postId, title: 'Current' }
    ] as never);
    vi.mocked(postService.removePostById).mockResolvedValue({
      _id: postId,
      visible: false
    } as never);
    const res = response();
    const next = vi.fn();

    await postController.removePost(
      request({ params: { id: postId } }),
      res,
      next
    );

    expect(postService.removePostById).toHaveBeenCalledWith(
      expect.objectContaining({ id: postId }),
      userId,
      accountId
    );
    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message: 'Post deleted successfully'
    });
  });

  it.each([
    ['likePost', 'likePost', 'Post like updated successfully'],
    ['dislikePost', 'dislikePost', 'Post dislike updated successfully']
  ] as const)('%s scopes reactions to the authenticated tenant', async (
    controllerMethod,
    serviceMethod,
    message
  ) => {
    const updated = { _id: postId, likes: [userId] };
    vi.mocked(postService[serviceMethod]).mockResolvedValue(updated as never);
    const res = response();
    const next = vi.fn();

    await postController[controllerMethod](
      request({ params: { id: postId } }),
      res,
      next
    );

    expect(postService[serviceMethod]).toHaveBeenCalledWith(
      expect.objectContaining({ id: postId }),
      userId,
      accountId
    );
    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message,
      data: updated
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns the established not-found error for a missing tenant post', async () => {
    vi.mocked(postService.getAllPosts).mockResolvedValue([]);
    const res = response();
    const next = vi.fn();

    await postController.getPost(
      request({ params: { id: postId } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Post not found'
    }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns the established list not-found error when no post is visible', async () => {
    vi.mocked(postService.getAllPosts).mockResolvedValue([]);
    const res = response();
    const next = vi.fn();

    await postController.getPosts(request(), res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Posts not found'
    }));
  });

  it.each([
    {
      name: 'insert misses',
      insert: null,
      committed: [],
      message: 'Post not created'
    },
    {
      name: 'committed read misses',
      insert: { _id: postId },
      committed: [],
      message: 'Post not found'
    }
  ])('fails creation when $name', async ({
    insert,
    committed,
    message
  }) => {
    vi.mocked(postService.insertPost).mockResolvedValue(insert as never);
    vi.mocked(postService.getAllPosts).mockResolvedValue(committed as never);
    const res = response();
    const next = vi.fn();

    await postController.createPost(
      request({ body: { title: 'Pump inspection' } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message
    }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    ['updatePost', 'missing current post', [], { _id: postId }, [{ _id: postId }], 'Post not found'],
    ['updatePost', 'mutation miss', [{ _id: postId }], null, [{ _id: postId }], 'Post not updated'],
    ['updatePost', 'committed read miss', [{ _id: postId }], { _id: postId }, [], 'Post not found'],
    ['partialUpdatePost', 'missing current post', [], { _id: postId }, [{ _id: postId }], 'Post not found'],
    ['partialUpdatePost', 'mutation miss', [{ _id: postId }], null, [{ _id: postId }], 'Post not updated'],
    ['partialUpdatePost', 'committed read miss', [{ _id: postId }], { _id: postId }, [], 'Post not found']
  ] as const)('%s fails closed on %s', async (
    controllerMethod,
    _caseName,
    current,
    mutation,
    committed,
    message
  ) => {
    vi.mocked(postService.getAllPosts)
      .mockResolvedValueOnce(current as never)
      .mockResolvedValueOnce(committed as never);
    vi.mocked(postService.updatePostById).mockResolvedValue(mutation as never);
    const res = response();
    const next = vi.fn();

    await postController[controllerMethod](request({
      params: { id: postId },
      body: { title: 'Updated' }
    }), res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message
    }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    ['missing current post', [], { _id: postId }, 'Post not found'],
    ['mutation miss', [{ _id: postId }], null, 'Post not deleted']
  ] as const)('fails deletion on %s', async (
    _caseName,
    current,
    mutation,
    message
  ) => {
    vi.mocked(postService.getAllPosts).mockResolvedValue(current as never);
    vi.mocked(postService.removePostById).mockResolvedValue(mutation as never);
    const res = response();
    const next = vi.fn();

    await postController.removePost(
      request({ params: { id: postId } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message
    }));
  });

  it.each([
    ['likePost', 'likePost'],
    ['dislikePost', 'dislikePost']
  ] as const)('%s forwards scoped service errors', async (
    controllerMethod,
    serviceMethod
  ) => {
    const failure = Object.assign(new Error('Post not found'), { status: 404 });
    vi.mocked(postService[serviceMethod]).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await postController[controllerMethod](
      request({ params: { id: postId } }),
      res,
      next
    );

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});
