import { createClient, RedisClientType } from 'redis';
import { database } from '../configDB';

export class RedisConnection {
  private static client: RedisClientType | null = null;
  static async connect(): Promise<RedisClientType> {
    if (this.client && this.client.isOpen) {
      console.log('⚡ Redis already connected');
      return this.client;
    }
    try {
      const redisUrl = `redis://${database.redis_host}:${database.redis_port}`;
      this.client = createClient({ url: redisUrl });

      this.client.on('connect', () => console.log('✅ Redis connected'));
      this.client.on('error', (err) => console.error('❌ Redis error:', err));

      await this.client.connect();

      console.log('✅ Redis client ready');
      return this.client;
    } catch (error) {
      console.error('❌ Redis connection error:', error);
      process.exit(1);
    }
  }

  static async disconnect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      await this.client.quit();
      this.client = null;
      console.log('✅ Redis disconnected');
    }
  }
}
