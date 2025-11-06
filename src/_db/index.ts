import { MongoConnection } from './mongo.connection';
import { RedisConnection } from './redis.connection';

export const connectDB = async () => {
  const mongo = await MongoConnection.connect();
  const redis = await RedisConnection.connect();
  console.log('✅ All databases connected successfully');
  return { mongo, redis };
};

export const disconnectDB = async () => {
  await MongoConnection.disconnect();
  await RedisConnection.disconnect();
  console.log('✅ All databases disconnected successfully');
};
