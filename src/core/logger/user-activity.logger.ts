import { ILogger } from './logger.interface';
import { LogQueue } from './log-queue';

/**
 * UserActivityLogger is the main facade for the logging system.
 * It strictly adheres to the ILogger interface, ensuring that logging calls
 * from the application layer remain entirely non-blocking.
 */
export class UserActivityLogger implements ILogger {
  private queue: LogQueue;

  constructor(batchSize = 100, flushIntervalMs = 5000) {
    this.queue = new LogQueue({
      batchSize,
      flushIntervalMs
    });
  }

  /**
   * Logs a user activity. 
   * This is guaranteed to be an O(1) operation that returns immediately,
   * completely decoupling the main application thread from network I/O.
   */
  public logActivity(userId: string, action: string, metadata?: Record<string, any>): void {
    const log: any = {
      userId,
      action,
      metadata,
      createdAt: new Date()
    };
    this.queue.push(log);
  }

  public async shutdown(): Promise<void> {
    await this.queue.shutdown();
  }
}

// Export a singleton instance configured with optimal defaults
export const userLogger = new UserActivityLogger(100, 5000);
