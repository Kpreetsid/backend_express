import { Types } from 'mongoose';
import { PostModel, IPost } from '../../models/post.model';
import { CommentsModel } from '../../models/comment.model';
import { LocationModel } from '../../models/location.model';
import { IUser, UserModel } from '../../models/user.model';
import { helperService } from '../../utils/helper';
import { sanitizePostPayload, SanitizedPostPayload } from './post.policy';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';

interface PostMutationOptions {
  partial?: boolean;
}

class PostService {
  async getAllPosts(match: Record<string, any>, accountId: any): Promise<IPost[]> {
    const accountObjectId = helperService.validateObjectId(String(accountId));
    return await PostModel.aggregate([
      { $match: { ...match, account_id: accountObjectId } },
      { $sort: { pinned: -1, createdAt: -1, _id: -1 } },
      {
        $lookup: {
          from: UserModel.collection.name,
          let: { userId: '$createdBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$userId'] }, account_id: accountObjectId } },
            { $project: { _id: 1, id: '$_id', firstName: 1, lastName: 1, email: 1, user_role: 1, user_profile_img: 1, username: 1, user_status: 1 } }
          ],
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { publishTo: { $ifNull: ['$publishTo', []] } },
          pipeline: [
            { $match: { account_id: accountObjectId, visible: true, $expr: { $in: [{ $toString: '$_id' }, '$$publishTo'] } } },
            { $project: { _id: 1, id: '$_id', location_name: 1, name: '$location_name', location_type: 1, type: '$location_type', top_level: 1, parent_id: 1, visible: 1 } }
          ],
          as: 'locations'
        }
      },
      {
        $lookup: {
          from: CommentsModel.collection.name,
          let: { postId: '$_id' },
          pipeline: [
            { $match: { account_id: accountObjectId, visible: true, $expr: { $eq: ['$post_id', '$$postId'] } } },
            { $count: 'count' }
          ],
          as: 'commentSummary'
        }
      },
      {
        $addFields: {
          id: '$_id',
          commentCount: { $ifNull: [{ $arrayElemAt: ['$commentSummary.count', 0] }, 0] }
        }
      },
      { $project: { 'user.password': 0, commentSummary: 0 } }
    ]);
  }

  async findAccessiblePost(match: Record<string, any>, accountId: any): Promise<any> {
    return await PostModel.findOne({
      ...match,
      account_id: helperService.validateObjectId(String(accountId)),
      visible: true
    }).lean();
  }

  async applyAudienceScope(match: Record<string, any>, user: IUser, canManage: boolean): Promise<Record<string, any>> {
    if (canManage) return match;
    const mappedLocations: any[] = await mapUserToLocationService.getLocationsMappedData(user._id);
    const locationIds = Array.from(new Set(
      mappedLocations
        .map(item => item?.locationId ? String(item.locationId) : '')
        .filter(Boolean)
    ));
    return {
      ...match,
      status: 'Published',
      $and: [
        ...(Array.isArray(match.$and) ? match.$and : []),
        {
          $or: [
            { visibility: { $ne: 'Locations' } },
            ...(locationIds.length ? [{ visibility: 'Locations', publishTo: { $in: locationIds } }] : [])
          ]
        }
      ]
    };
  }

  async insertPost(body: unknown, accountId: any, userId: any): Promise<any> {
    const payload = sanitizePostPayload(body);
    const accountObjectId = helperService.validateObjectId(String(accountId));
    const userObjectId = helperService.validateObjectId(String(userId));
    await this.assertReferences(payload, accountObjectId);
    this.assertSchedule(payload, null);

    const now = new Date();
    const reviewHistory = [{
      status: payload.status,
      ...(payload.reviewNote ? { note: payload.reviewNote } : {}),
      reviewedBy: userObjectId,
      reviewedAt: now
    }];
    const data = this.toStoredPayload(payload);
    const newPost = new PostModel({
      ...data,
      account_id: accountObjectId,
      createdBy: userObjectId,
      publishedAt: payload.status === 'Published' ? now : null,
      reviewHistory
    });
    return await newPost.save();
  }

  async updatePostById(id: any, body: unknown, accountId: any, userId: any, options: PostMutationOptions = {}): Promise<any> {
    const postId = helperService.validateObjectId(String(id));
    const accountObjectId = helperService.validateObjectId(String(accountId));
    const userObjectId = helperService.validateObjectId(String(userId));
    const existing: any = await PostModel.findOne({ _id: postId, account_id: accountObjectId, visible: true }).lean();
    if (!existing) return null;

    const input = this.pickSupportedFields(body);
    const merged = options.partial ? { ...this.toPolicyInput(existing), ...input } : input;
    const payload = sanitizePostPayload(merged);
    await this.assertReferences(payload, accountObjectId);
    this.assertSchedule(payload, existing);

    const statusChanged = existing.status !== payload.status;
    const reviewHistory = Array.isArray(existing.reviewHistory) ? existing.reviewHistory.slice(-99) : [];
    if (statusChanged || payload.reviewNote) {
      reviewHistory.push({
        status: payload.status,
        ...(payload.reviewNote ? { note: payload.reviewNote } : {}),
        reviewedBy: userObjectId,
        reviewedAt: new Date()
      });
    }

    const update: Record<string, any> = {
      ...this.toStoredPayload(payload),
      reviewHistory,
      updatedBy: userObjectId
    };
    if (payload.status === 'Published' && !existing.publishedAt) update.publishedAt = new Date();
    if (payload.status !== 'Published' && existing.publishedAt) update.publishedAt = existing.publishedAt;

    return await PostModel.findOneAndUpdate(
      { _id: postId, account_id: accountObjectId, visible: true },
      { $set: update },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async removePostById(id: any, accountId: any, userId: any): Promise<any> {
    return await PostModel.findOneAndUpdate(
      { _id: helperService.validateObjectId(String(id)), account_id: helperService.validateObjectId(String(accountId)), visible: true },
      { $set: { visible: false, updatedBy: helperService.validateObjectId(String(userId)) } },
      { returnDocument: 'after' }
    );
  }

  async likePost(id: any, accountId: any, userId: any): Promise<any> {
    return await this.toggleReaction(id, accountId, userId, 'likes', 'dislikes');
  }

  async dislikePost(id: any, accountId: any, userId: any): Promise<any> {
    return await this.toggleReaction(id, accountId, userId, 'dislikes', 'likes');
  }

  private async toggleReaction(id: any, accountId: any, userId: any, target: 'likes' | 'dislikes', opposite: 'likes' | 'dislikes'): Promise<any> {
    const user = String(helperService.validateObjectId(String(userId)));
    const result = await PostModel.findOneAndUpdate(
      {
        _id: helperService.validateObjectId(String(id)),
        account_id: helperService.validateObjectId(String(accountId)),
        visible: true
      },
      [{
        $set: {
          [target]: {
            $cond: [
              { $in: [user, { $ifNull: [`$${target}`, []] }] },
              { $setDifference: [{ $ifNull: [`$${target}`, []] }, [user]] },
              { $setUnion: [{ $ifNull: [`$${target}`, []] }, [user]] }
            ]
          },
          [opposite]: { $setDifference: [{ $ifNull: [`$${opposite}`, []] }, [user]] }
        }
      }],
      { returnDocument: 'after' }
    );
    if (!result) throw Object.assign(new Error('Post not found'), { status: 404 });
    return result;
  }

  private async assertReferences(payload: SanitizedPostPayload, accountId: Types.ObjectId): Promise<void> {
    if (!payload.publishTo.length) return;
    const ids = helperService.validateObjectIds(payload.publishTo, 100);
    const count = await LocationModel.countDocuments({ _id: { $in: ids }, account_id: accountId, visible: true });
    if (count !== ids.length) throw Object.assign(new Error('One or more publish locations are invalid'), { status: 400 });
  }

  private assertSchedule(payload: SanitizedPostPayload, existing: any): void {
    if (payload.status !== 'Scheduled') return;
    if (!payload.scheduledAt) throw Object.assign(new Error('Scheduled date is required for scheduled posts'), { status: 400 });
    const unchanged = existing?.status === 'Scheduled'
      && existing?.scheduledAt
      && new Date(existing.scheduledAt).getTime() === payload.scheduledAt.getTime();
    if (!unchanged && payload.scheduledAt.getTime() <= Date.now()) {
      throw Object.assign(new Error('Scheduled date must be in the future'), { status: 400 });
    }
  }

  private toStoredPayload(payload: SanitizedPostPayload): Record<string, any> {
    const { reviewNote: _reviewNote, ...stored } = payload;
    return stored;
  }

  private toPolicyInput(existing: any): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of [
      'title', 'subtitle', 'postType', 'relatedTo', 'tags', 'description', 'files', 'publishTo',
      'status', 'visibility', 'featured', 'pinned', 'slug', 'seoTitle', 'seoDescription',
      'keywords', 'scheduledAt', 'commentsEnabled', 'help'
    ]) {
      if (existing[key] !== undefined) result[key] = existing[key];
    }
    result.title ??= '';
    result.postType ??= 'General';
    result.relatedTo ??= 'Other';
    result.description ??= '';
    result.status ??= 'Published';
    result.visibility ??= existing.publishTo?.length ? 'Locations' : 'Account';
    return result;
  }

  private pickSupportedFields(body: unknown): Record<string, any> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw Object.assign(new Error('Post payload must be an object'), { status: 400 });
    }
    const allowed = new Set([
      'title', 'subtitle', 'postType', 'relatedTo', 'tags', 'description', 'files', 'publishTo',
      'status', 'visibility', 'featured', 'pinned', 'slug', 'seoTitle', 'seoDescription',
      'keywords', 'scheduledAt', 'commentsEnabled', 'reviewNote', 'help'
    ]);
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowed.has(key)) result[key] = value;
    }
    if (!Object.keys(result).length) throw Object.assign(new Error('No supported post fields were provided'), { status: 400 });
    return result;
  }
}

export const postService = new PostService();
