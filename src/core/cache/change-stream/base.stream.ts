import mongoose from 'mongoose';
import { RedisUtils } from '../redis.utils';

/**
 * Base Change Stream class that provides a robust, self-healing MongoDB 
 * Change Data Capture (CDC) streaming mechanism.
 * 
 * Features:
 * - Auto-reconnection with exponential backoff on stream death.
 * - Resume tokens persisted in Redis to prevent data loss across restarts.
 * - Centralized error handling.
 */
export abstract class BaseChangeStream {
  protected collectionName: string;
  protected connection: mongoose.Connection;
  private changeStream: mongoose.mongo.ChangeStream | null = null;
  private tokenKey: string;
  private isReconnecting = false;
  private retryDelayMs = 2000;
  private maxRetryDelayMs = 60000; // 1 minute max backoff

  constructor(connection: mongoose.Connection, collectionName: string) {
    this.connection = connection;
    this.collectionName = collectionName;
    this.tokenKey = `cmms:cdc:token:${this.collectionName}`;
  }

  /**
   * Must be implemented by child classes to handle the actual invalidation logic.
   */
  protected abstract handleChange(event: any): Promise<void>;

  /**
   * Starts or resumes the change stream.
   */
  public async start(): Promise<void> {
    if (!this.connection || this.connection.readyState !== 1) {
      console.warn(`[CDC:${this.collectionName}] MongoDB not connected, delaying stream start...`);
      setTimeout(() => this.start(), 5000);
      return;
    }

    try {
      const collection = this.connection.collection(this.collectionName);
      const options: any = { fullDocument: 'updateLookup' };

      // Attempt to load the last processed token to resume where we left off
      const lastToken = await RedisUtils.get<any>(this.tokenKey);
      if (lastToken) {
        options.resumeAfter = { _data: lastToken };
        console.log(`[CDC:${this.collectionName}] Resuming stream from last known token.`);
      }

      this.changeStream = collection.watch([], options);
      this.isReconnecting = false;
      this.retryDelayMs = 2000; // Reset backoff on success

      console.log(`✅ [CDC] ${this.collectionName} change stream active`);

      this.changeStream.on('change', async (event: any) => {
        try {
          // Pre-images are required for 'delete' events to retain the full document
          event.effectiveDocument = event.fullDocument || event.fullDocumentBeforeChange;
          
          await this.handleChange(event);

          // Only save the token after successful processing
          if (event._id?._data) {
             await RedisUtils.set(this.tokenKey, event._id._data);
          }
        } catch (err) {
          console.error(`[CDC:${this.collectionName}] Error processing change event:`, err);
        }
      });

      this.changeStream.on('error', (err) => {
        console.error(`[CDC:${this.collectionName}] Stream error:`, err.message);
        this.triggerReconnect();
      });

    } catch (err: any) {
      // If resumeAfter is invalid (e.g. oplog rolled over), we must clear the token and restart
      if (err.message && err.message.includes('resume token')) {
        console.warn(`[CDC:${this.collectionName}] Invalid resume token, resetting stream...`);
        await RedisUtils.delete(this.tokenKey);
        this.triggerReconnect();
        return;
      }

      console.warn(`[CDC:${this.collectionName}] Stream initialization failed:`, err.message);
      this.triggerReconnect();
    }
  }

  private triggerReconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    
    if (this.changeStream) {
      this.changeStream.close().catch(() => {});
      this.changeStream = null;
    }

    console.log(`[CDC:${this.collectionName}] Reconnecting in ${this.retryDelayMs}ms...`);
    setTimeout(() => {
      this.start();
    }, this.retryDelayMs);

    // Exponential backoff
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, this.maxRetryDelayMs);
  }
}
