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
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
