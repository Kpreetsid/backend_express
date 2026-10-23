import { getRedisClient, isRedisReady } from '../cache/redis.client';
import { IUserLog } from '../../modules/users/models/userLogs.model';

export const USER_LOGS_STREAM_KEY = 'cmms:user:logs:stream';
export const USER_LOGS_CONSUMER_GROUP = 'cmms:user:logs:group';

export class UserLogProducer {
  /**
   * Pushes a log object to the Redis Stream. 
   * If Redis is unavailable, it gracefully degrades by falling back to a direct MongoDB insert.
   */
  static async pushLog(logDocument: IUserLog): Promise<void> {
    try {
      if (!isRedisReady()) {
        // Graceful Fallback: direct MongoDB save
        await logDocument.save();
        return;
      }

      const client = getRedisClient();
      if (!client) {
        await logDocument.save();
        return;
      }

      // Serialize the mongoose document into a plain JS object, then to JSON string
      const payload = JSON.stringify(logDocument.toObject ? logDocument.toObject() : logDocument);

      // XADD key * field string
      // MAXLEN ~ 10000 ensures the stream doesn't grow infinitely and crash Redis memory
      await client.xadd(USER_LOGS_STREAM_KEY, 'MAXLEN', '~', 10000, '*', 'payload', payload);
      
    } catch (error) {
      console.error('[UserLogProducer] Failed to push to Redis stream. Falling back to MongoDB.', error);
      try {
        await logDocument.save();
      } catch (dbError) {
        console.error('[UserLogProducer] Fallback MongoDB save failed too:', dbError);
      }
    }
  }
}
