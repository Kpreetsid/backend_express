import { applicationLogger } from '../observability/logger';
import mongoose, { ClientSession } from 'mongoose';

let transactionsUnsupported = false;
let transactionsUnsupportedWarningShown = false;

const isUnsupportedTransactionError = (error: any): boolean => {
  const errorMessage = error?.message || error?.errmsg || String(error);
  return errorMessage.includes("Transaction numbers are only allowed") ||
    errorMessage.includes("does not support retryable writes") ||
    errorMessage.includes("Transaction is not supported") ||
    errorMessage.includes("replica set member or mongos") ||
    error?.code === 20 ||
    error?.codeName === 'IllegalOperation';
};

const warnUnsupportedTransactionsOnce = (error?: any): void => {
  if (transactionsUnsupportedWarningShown) return;
  transactionsUnsupportedWarningShown = true;
  applicationLogger.warn("MongoDB transactions are not supported by the current deployment. Running transaction blocks without a session.");
  if (error) {
    const errorMessage = error?.message || error?.errmsg || String(error);
    applicationLogger.warn(`Original transaction error: ${errorMessage}`);
  }
};

/**
 * Executes a function within a MongoDB transaction.
 * @param fn The function to execute within the transaction. It receives the session object.
 * @returns The result of the function execution.
 */
export const withTransaction = async <T>(fn: (session: ClientSession) => Promise<T>, existingSession?: any): Promise<T> => {
  if (existingSession) {
    return await fn(existingSession);
  }
  if (transactionsUnsupported) {
    return await fn(undefined as any);
  }

  const session = await mongoose.startSession();
  let sessionEnded = false;

  try {
    session.startTransaction({ readPreference: 'primary' });
    const result = await fn(session);
    await session.commitTransaction();
    sessionEnded = true;
    await session.endSession();
    return result;
  } catch (error: any) {
    const isStandaloneError = isUnsupportedTransactionError(error);

    if (isStandaloneError) {
      transactionsUnsupported = true;
      warnUnsupportedTransactionsOnce(error);
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
