import { RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

export const setRedisClient = (client: RedisClientType) => {
  redisClient = client;
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error("❌ Redis client not initialized!");
  }
  return redisClient;
};

export const clearRedisClient = () => {
  redisClient = null;
};