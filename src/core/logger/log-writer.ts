import { getRedisClient, isRedisReady } from '../cache/redis.client';
import { UserLogModel, IUserLog } from '../../modules/users/models/userLogs.model';
import { USER_LOGS_STREAM_KEY } from '../messaging/user-log.producer';

/**
 * LogWriter acts as the 'Consumer' of the in-memory LogQueue.
 * It is responsible for efficiently persisting batches of logs to Redis Streams,
 * or falling back to MongoDB if Redis is unavailable, without crashing the main process.
 */
export class LogWriter {
  /**
   * Writes a batch of logs to the persistent store.
   * Uses Redis pipelining for maximum network efficiency.
   * 
   * @param logs Array of raw log objects
   */
  static async writeBatch(logs: Partial<IUserLog>[]): Promise<void> {
    if (logs.length === 0) return;

    try {
      if (isRedisReady()) {
        const client = getRedisClient();
        if (client) {
          // Use a Redis pipeline to send all XADD commands in a single network round-trip
          const pipeline = client.pipeline();

          for (const log of logs) {
            const payload = JSON.stringify(log);
            // MAXLEN ~ 10000 ensures the stream doesn't grow infinitely
            pipeline.xadd(USER_LOGS_STREAM_KEY, 'MAXLEN', '~', 10000, '*', 'payload', payload);
          }

          // Execute the pipeline
          const results = await pipeline.exec();
          
          // Check for pipeline execution errors
          const errors = results?.filter(([err]) => err !== null) || [];
          if (errors.length === 0) {
            return; // Successfully written to Redis
          }
          console.warn(`[LogWriter] Pipeline executed with ${errors.length} errors. Falling back to MongoDB.`);
        }
      }
    } catch (redisError) {
      console.warn('[LogWriter] Redis batch write failed. Falling back to MongoDB.', redisError);
    }

    // Graceful Fallback: If Redis is down, insert directly to MongoDB
    await this.fallbackToMongo(logs);
  }

  /**
   * Directly saves logs to MongoDB in a bulk operation.
   */
  private static async fallbackToMongo(logs: Partial<IUserLog>[]): Promise<void> {
    try {
      await UserLogModel.insertMany(logs, { ordered: false });
    } catch (dbError) {
      // In a catastrophic failure (both Redis and Mongo are down), 
      // we log to standard error to prevent taking down the main API process.
      console.error('[LogWriter] FATAL: Failed to write logs to both Redis and MongoDB:', dbError);
    }
  }
}
