import { createClient } from 'redis';
import dotenv from 'dotenv';
import { database  } from '../configDB';
dotenv.config();

const redisClient = createClient({
  url: `redis://${database.redis_host}:${database.redis_port}`,
});

redisClient.on('connect', () => console.log('✅ Redis connected'));
redisClient.on('error', (error: any) => console.error('❌ Redis Error:', error));

(async () => {
  if (!redisClient.isOpen) await redisClient.connect();
})();

export default redisClient;