import { PostModel } from '../../modules/communications/models/post.model';

class PostPublishingService {
  private readonly batchSize = 500;

  async publishDuePosts(now: Date = new Date()): Promise<number> {
    const candidates: any[] = await PostModel.find({
      visible: true,
      status: 'Scheduled',
      scheduledAt: { $ne: null, $lte: now }
    })
      .sort({ scheduledAt: 1, _id: 1 })
      .limit(this.batchSize)
      .select('_id createdBy')
      .lean();
    if (!candidates.length) return 0;

    const result: any = await PostModel.bulkWrite(candidates.map(post => ({
      updateOne: {
        filter: {
          _id: post._id,
          visible: true,
          status: 'Scheduled',
          scheduledAt: { $ne: null, $lte: now }
        },
        update: {
          $set: {
            status: 'Published',
            publishedAt: now,
            updatedBy: post.createdBy
          },
          $push: {
            reviewHistory: {
              $each: [{ status: 'Published', reviewedBy: post.createdBy, reviewedAt: now }],
              $slice: -100
            }
          }
        }
      }
    })), { ordered: false });
    return Number(result.modifiedCount || 0);
  }
}

export const postPublishingService = new PostPublishingService();
