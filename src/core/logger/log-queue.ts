import { IUserLog } from '../../modules/users/models/userLogs.model';
import { LogWriter } from './log-writer';

export interface LogQueueOptions {
  batchSize: number;
  flushIntervalMs: number;
}

/**
 * LogQueue acts as the 'Producer' queue.
 * It stores incoming logs in memory (O(1) insertion) and flushes them 
 * asynchronously based on size or time limits.
 */
export class LogQueue {
  private buffer: Partial<IUserLog>[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(options: LogQueueOptions) {
    this.batchSize = options.batchSize;
    this.flushIntervalMs = options.flushIntervalMs;
    this.startTimer();
  }

  /**
   * Pushes a log into the memory queue instantly.
   */
  public push(log: Partial<IUserLog>): void {
    this.buffer.push(log);
    if (this.buffer.length >= this.batchSize) {
      // Don't await the flush, keep it asynchronous to avoid blocking
      void this.flush();
    }
  }

  /**
   * Flushes the current buffer to the LogWriter.
   */
  public async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;

    // Safely drain the current buffer so new logs can accumulate simultaneously
    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      await LogWriter.writeBatch(batch);
    } catch (error) {
      console.error('[LogQueue] Unhandled error in flush operation:', error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Shuts down the queue and forces a final flush.
   */
  public async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }
}
