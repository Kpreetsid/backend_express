import { getRedisClient, isRedisReady } from '../../_config/redis';
import { UserLogModel } from '../../models/userLogs.model';
import { USER_LOGS_STREAM_KEY, USER_LOGS_CONSUMER_GROUP } from './userLogProducer';

const CONSUMER_NAME = `consumer-${process.pid}`;
const BATCH_SIZE = 500;
const BLOCK_TIME_MS = 5000;

export class UserLogConsumer {
  private static isRunning = false;

  private static consumerClient: any = null;

  static async initialize() {
    if (!isRedisReady()) {
      console.log('[UserLogConsumer] Redis unavailable. Consumer not starting.');
      return;
    }

    const mainClient = getRedisClient();
    if (!mainClient) return;

    try {
      // Create consumer group if it doesn't exist
      await mainClient.xgroup('CREATE', USER_LOGS_STREAM_KEY, USER_LOGS_CONSUMER_GROUP, '0', 'MKSTREAM');
      console.log(`[UserLogConsumer] Consumer group ${USER_LOGS_CONSUMER_GROUP} created.`);
    } catch (error: any) {
      if (!error.message.includes('BUSYGROUP')) {
        console.error('[UserLogConsumer] Error creating consumer group:', error);
      }
    }

    if (!this.isRunning) {
      this.isRunning = true;
      console.log(`[UserLogConsumer] Starting polling loop on ${CONSUMER_NAME}...`);
      // Duplicate client for blocking operations
      this.consumerClient = (mainClient as any).duplicate();
      this.poll();
    }
  }

  private static async poll() {
    while (this.isRunning) {
      try {
        if (!this.consumerClient) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        if (this.consumerClient.status === 'wait') {
           this.consumerClient.connect().catch(() => {});
        }

        if (this.consumerClient.status !== 'ready') {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        // Read messages from the stream
        // '>' means "messages that have never been delivered to other consumers in this group"
        const results = await this.consumerClient.xreadgroup(
          'GROUP', USER_LOGS_CONSUMER_GROUP, CONSUMER_NAME,
          'COUNT', BATCH_SIZE,
          'BLOCK', BLOCK_TIME_MS,
          'STREAMS', USER_LOGS_STREAM_KEY, '>'
        ) as any[];

        if (results && results.length > 0) {
          const streamData = results[0];
          const messages = streamData[1]; // Array of [messageId, [field1, value1, ...]]

          if (messages.length > 0) {
            await this.processBatch(messages, this.consumerClient);
          }
        }
      } catch (error) {
        console.error('[UserLogConsumer] Error during polling:', error);
        // Sleep briefly to avoid tight loop on error
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  private static async processBatch(messages: any[], client: any) {
    const documentsToInsert = [];
    const messageIds = [];

    for (const message of messages) {
      const messageId = message[0];
      const fields = message[1]; // ['payload', '{...}']
      
      let payloadIndex = fields.indexOf('payload');
      if (payloadIndex !== -1 && payloadIndex + 1 < fields.length) {
        try {
          const payloadStr = fields[payloadIndex + 1];
          const logObj = JSON.parse(payloadStr);
          documentsToInsert.push(logObj);
          messageIds.push(messageId);
        } catch (e) {
          console.error(`[UserLogConsumer] Failed to parse log payload for msgId ${messageId}`, e);
          // Acknowledge malformed messages so they don't block the queue
          messageIds.push(messageId);
        }
      }
    }

    if (documentsToInsert.length > 0) {
      try {
        // Bulk insert to MongoDB
        await UserLogModel.insertMany(documentsToInsert, { ordered: false });
        console.log(`[UserLogConsumer] Batch inserted ${documentsToInsert.length} logs to MongoDB.`);
      } catch (dbError: any) {
        console.error('[UserLogConsumer] Failed to insertMany:', dbError.message);
        // If DB insertion fails completely, we DO NOT acknowledge the messages, 
        // so they can be read again later (via pending list recovery - not implemented here for simplicity, 
        // but they remain un-acked).
        return;
      }
    }

    if (messageIds.length > 0) {
      try {
        await client.xack(USER_LOGS_STREAM_KEY, USER_LOGS_CONSUMER_GROUP, ...messageIds);
      } catch (ackErr) {
        console.error('[UserLogConsumer] Failed to XACK messages:', ackErr);
      }
    }
  }

  static stop() {
    this.isRunning = false;
  }
}
