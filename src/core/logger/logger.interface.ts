export interface ILogger {
  /**
   * Logs a user activity asynchronously without blocking the main thread.
   * This method returns immediately (void) and pushes the log to an in-memory queue.
   * 
   * @param userId The ID of the user performing the action
   * @param action The action being performed (e.g., 'LOGIN', 'CREATE_ASSET')
   * @param metadata Optional metadata related to the action
   */
  logActivity(userId: string, action: string, metadata?: Record<string, any>): void;

  /**
   * Gracefully shuts down the logger, flushing any remaining logs in the queue.
   * Should be called during application teardown (SIGTERM/SIGINT).
   */
  shutdown(): Promise<void>;
}
