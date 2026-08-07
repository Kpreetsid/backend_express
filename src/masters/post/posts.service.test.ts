import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationModel } from '../../models/location.model';
import { PostModel } from '../../models/post.model';
import { UserModel } from '../../models/user.model';
import { postService } from './posts.service';

const postModelMocks = vi.hoisted(() => ({
  save: vi.fn(),
  aggregate: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn()
}));

vi.mock('../../models/post.model', () => {
  const PostModelMock: any = vi.fn(function (this: any, body: any) {
    Object.assign(this, body);
    this.save = postModelMocks.save;
  });
  PostModelMock.aggregate = postModelMocks.aggregate;
  PostModelMock.findOne = postModelMocks.findOne;
  PostModelMock.findOneAndUpdate = postModelMocks.findOneAndUpdate;
  return { PostModel: PostModelMock };
});
vi.mock('../../models/location.model', () => ({
  LocationModel: { collection: { name: 'locations' } }
}));
vi.mock('../../models/user.model', () => ({
  UserModel: { collection: { name: 'users' } }
}));

describe('post service tenant mutation boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const otherAccountId = '507f1f77bcf86cd799439099';
  const userId = { toString: () => '507f1f77bcf86cd799439012' };
  const postId = '507f1f77bcf86cd799439013';

  beforeEach(() => {
    vi.clearAllMocks();
    postModelMocks.findOneAndUpdate.mockResolvedValue({ _id: postId });
  });

  it('keeps aggregate reads under the caller-owned match', async () => {
    const posts = [{ _id: postId, title: 'Pump inspection' }];
    postModelMocks.aggregate.mockResolvedValue(posts);

    await expect(postService.getAllPosts({
      account_id: accountId,
      visible: true
    })).resolves.toBe(posts);

    const pipeline = postModelMocks.aggregate.mock.calls[0]![0];
    expect(pipeline[0]).toEqual({
      $match: { account_id: accountId, visible: true }
    });
    expect(pipeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        $lookup: expect.objectContaining({ from: UserModel.collection.name })
      }),
      expect.objectContaining({
        $lookup: expect.objectContaining({ from: LocationModel.collection.name })
      })
    ]));
  });

  it('inserts the server-owned post body through the model', async () => {
    const saved = { _id: postId };
    postModelMocks.save.mockResolvedValue(saved);

    await expect(postService.insertPost({
      account_id: accountId,
      title: 'Pump inspection'
    })).resolves.toBe(saved);

    expect(PostModel).toHaveBeenCalledWith({
      account_id: accountId,
      title: 'Pump inspection'
    });
    expect(postModelMocks.save).toHaveBeenCalledOnce();
  });

  it('strips protected and aggregate-only fields before a scoped update', async () => {
    await postService.updatePostById(postId, {
      _id: 'attacker-id',
      id: 'attacker-public-id',
      account_id: otherAccountId,
      createdBy: 'attacker-user',
      createdAt: 'old',
      updatedAt: 'old',
      user: { password: 'should-not-persist' },
      locations: [{ id: 'location-1' }],
      title: 'Updated title'
    }, userId, accountId);

    expect(postModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: postId, account_id: accountId, visible: true },
      { title: 'Updated title', updatedBy: userId },
      { returnDocument: 'after' }
    );
  });

  it('soft deletes only a visible post in the authenticated tenant', async () => {
    await postService.removePostById(postId, userId, accountId);

    expect(postModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: postId, account_id: accountId, visible: true },
      { visible: false, updatedBy: userId },
      { returnDocument: 'after' }
    );
  });

  it.each([
    {
      method: 'likePost' as const,
      likes: ['507f1f77bcf86cd799439012'],
      dislikes: [],
      update: { $pull: { likes: userId } }
    },
    {
      method: 'likePost' as const,
      likes: [],
      dislikes: ['507f1f77bcf86cd799439012'],
      update: {
        $addToSet: { likes: userId },
        $pull: { dislikes: userId }
      }
    },
    {
      method: 'dislikePost' as const,
      likes: [],
      dislikes: ['507f1f77bcf86cd799439012'],
      update: { $pull: { dislikes: userId } }
    },
    {
      method: 'dislikePost' as const,
      likes: ['507f1f77bcf86cd799439012'],
      dislikes: [],
      update: {
        $addToSet: { dislikes: userId },
        $pull: { likes: userId }
      }
    }
  ])('$method applies the expected reaction update under tenant scope', async ({
    method,
    likes,
    dislikes,
    update
  }) => {
    postModelMocks.findOne.mockResolvedValue({ likes, dislikes });

    await postService[method](postId, userId, accountId);

    expect(postModelMocks.findOne).toHaveBeenCalledWith({
      _id: postId,
      account_id: accountId,
      visible: true
    });
    expect(postModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: postId, account_id: accountId, visible: true },
      update,
      { returnDocument: 'after' }
    );
  });

  it.each(['likePost', 'dislikePost'] as const)(
    '%s returns the established not-found error for a tenant miss',
    async method => {
      postModelMocks.findOne.mockResolvedValue(null);

      await expect(postService[method](postId, userId, accountId))
        .rejects.toMatchObject({ status: 404, message: 'Post not found' });
      expect(postModelMocks.findOneAndUpdate).not.toHaveBeenCalled();
    }
  );
});
