import { applicationLogger } from '../observability/logger';
import { MongoConnection } from './mongo.connection';

export const connectDB = async () => {
  const mongo = await MongoConnection.connect();
  applicationLogger.info('✅ All databases connected successfully');
  return { mongo };
};

export const disconnectDB = async () => {
  await MongoConnection.disconnect();
  applicationLogger.info('✅ All databases disconnected successfully');
};
