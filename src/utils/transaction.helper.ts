import mongoose, { ClientSession } from 'mongoose';

/**
 * Executes a function within a MongoDB transaction.
 * @param fn The function to execute within the transaction. It receives the session object.
 * @returns The result of the function execution.
 */
export const withTransaction = async <T>(fn: (session: ClientSession) => Promise<T>, existingSession?: any): Promise<T> => {
  if (existingSession) {
    return await fn(existingSession);
  }

  const session = await mongoose.startSession();
  let sessionEnded = false;

  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    sessionEnded = true;
    await session.endSession();
    return result;
  } catch (error: any) {
    const errorMessage = error.message || error.errmsg || String(error);
    const isStandaloneError =
      errorMessage.includes("Transaction numbers are only allowed") ||
      errorMessage.includes("does not support retryable writes") ||
      errorMessage.includes("Transaction is not supported") ||
      errorMessage.includes("replica set member or mongos") ||
      error.code === 20 ||
      error.codeName === 'IllegalOperation';

    if (isStandaloneError) {
      console.warn("⚠️ MongoDB Transactions are not supported (Standalone Instance). Falling back to non-transactional execution.");
      console.warn(`Original Error: ${errorMessage}`);
      if (!sessionEnded) {
        try {
          if (session.inTransaction()) await session.abortTransaction();
          await session.endSession();
        } catch (e) {}
        sessionEnded = true;
      }
      return await fn(undefined as any);
    }

    if (!sessionEnded) {
      try {
        if (session.inTransaction()) await session.abortTransaction();
        await session.endSession();
      } catch (e) {}
      sessionEnded = true;
    }
    throw error;
  } finally {
    if (!sessionEnded) {
      try {
        await session.endSession();
      } catch (e) {}
    }
  }
};
