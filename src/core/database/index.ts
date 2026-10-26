import { MongoConnection } from './mongo.connection';

export const connectDB = async () => {
  const mongo = await MongoConnection.connect();
  console.log('✅ All databases connected successfully');
  return { mongo };
};

export const disconnectDB = async () => {
  await MongoConnection.disconnect();
  console.log('✅ All databases disconnected successfully');
};
