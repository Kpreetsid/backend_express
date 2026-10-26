import mongoose, { ClientSession } from 'mongoose';

let transactionsUnsupported = false;
let transactionsUnsupportedWarningShown = false;
let transactionSupportChecked = false;

export const isUnsupportedTransactionError = (error: any): boolean => {
  const errorMessage = error?.message || error?.errmsg || String(error);
  return errorMessage.includes("Transaction numbers are only allowed") ||
    errorMessage.includes("does not support retryable writes") ||
    errorMessage.includes("Transaction is not supported") ||
    errorMessage.includes("replica set member or mongos") ||
    error?.code === 20 ||
    error?.codeName === 'IllegalOperation';
};

const deploymentSupportsTransactions = async (): Promise<boolean | undefined> => {
  if (transactionSupportChecked) return !transactionsUnsupported;
  const db = mongoose.connection.db;
  if (!db) return;

  try {
    const hello: any = await db.admin().command({ hello: 1 });
    transactionSupportChecked = true;
    const supported = Boolean(hello?.setName || hello?.msg === 'isdbgrid');
    if (!supported) transactionsUnsupported = true;
    return supported;
  } catch {
    // Some deployments do not authorize the hello command. In that case retain
    // the existing runtime fallback based on the transaction operation itself.
    return;
  }
};

const warnUnsupportedTransactionsOnce = (): void => {
  if (transactionsUnsupportedWarningShown) return;
  transactionsUnsupportedWarningShown = true;
  console.info("MongoDB standalone mode detected; using the supported non-transactional fallback.");
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

  const transactionsSupported = await deploymentSupportsTransactions();
  if (transactionsSupported === false) {
    warnUnsupportedTransactionsOnce();
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
      warnUnsupportedTransactionsOnce();
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
