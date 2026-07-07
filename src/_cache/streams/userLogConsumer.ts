import { getRedisClient, isRedisReady } from '../../_config/redis';
import { UserLogModel } from '../../models/userLogs.model';
import { USER_LOGS_STREAM_KEY, USER_LOGS_CONSUMER_GROUP } from './userLogProducer';
import fs from 'fs';
import path from 'path';

const CONSUMER_NAME = `consumer-${process.pid}`;
const BATCH_SIZE = 500;
const BLOCK_TIME_MS = 5000;

export class UserLogConsumer {
  private static isRunning = false;
  private static consumerClient: any = null;
  private static logDir = path.join(process.cwd(), 'logs');

  static async initialize() {
    if (!isRedisReady()) {
      console.log('[UserLogConsumer] Redis unavailable. Consumer not starting.');
      return;
    }

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
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
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  private static getIstDate() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset);
  }

  private static getMonthlyLogFileName(): string {
    const istDate = this.getIstDate();
    const month = istDate.toLocaleString('en-US', { month: 'long' });
    const year = istDate.getFullYear();
    return `${month}_${year}.log`;
  }

  private static mapAction(method: any): string {
    if (!method) return 'UNKNOWN';
    switch (method.toUpperCase()) {
      case 'GET': return 'READ';
      case 'POST': return 'CREATE';
      case 'PUT': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return method.toUpperCase();
    }
  }

  private static async processBatch(messages: any[], client: any) {
    const documentsToInsert = [];
    const messageIds = [];
    let fileLogContent = '';

    for (const message of messages) {
      const messageId = message[0];
      const fields = message[1]; 
      
      let payloadIndex = fields.indexOf('payload');
      if (payloadIndex !== -1 && payloadIndex + 1 < fields.length) {
        try {
          const payloadStr = fields[payloadIndex + 1];
          const logObj = JSON.parse(payloadStr);
          documentsToInsert.push(logObj);
          messageIds.push(messageId);

          // Build string formats for Console and File outputs
          const dateIst = this.getIstDate().toISOString().replace('Z', '+05:30');
          const userId = logObj.userId || 'Anonymous';
          const userName = logObj.userName || 'Anonymous';
          const method = logObj.method || 'UNKNOWN';
          const action = this.mapAction(method);
          const responseTime = logObj.additionalData?.durationMs || 0;
          const status = logObj.statusCode || 200;
          const url = logObj.requestUrl || 'unknown-url';
          const moduleName = logObj.module || 'general';
          const contentLength = logObj.networkInfo?.contentLength || 0;
          const remoteAddr = logObj.ipAddress || 'unknown';
          const device = logObj.userAgent || 'unknown';

          // Console format: :date_ist | :status | :userId | :userName | :action | :method | :response-time ms | :url
          const consoleStr = `${dateIst} | ${status} | ${userId} | ${userName} | ${action} | ${method} | ${responseTime} ms | ${url}`;
          console.log(consoleStr);

          // File format: :date_ist | :userId | :userName | :action | :method | :url | :module | :status | :res[content-length] | :response-time ms | IP: :remote-addr | Device: :device
          const fileStr = `${dateIst} | ${userId} | ${userName} | ${action} | ${method} | ${url} | ${moduleName} | ${status} | ${contentLength} | ${responseTime} ms | IP: ${remoteAddr} | Device: ${device}\n`;
          fileLogContent += fileStr;

        } catch (e) {
          console.error(`[UserLogConsumer] Failed to parse log payload for msgId ${messageId}`, e);
          messageIds.push(messageId);
        }
      }
    }

    // 1. Write to Monthly File
    if (fileLogContent.length > 0) {
      try {
        const logFilePath = path.join(this.logDir, this.getMonthlyLogFileName());
        fs.appendFileSync(logFilePath, fileLogContent);
      } catch (err: any) {
        console.error('[UserLogConsumer] Failed to write to log file:', err.message);
      }
    }

    // 2. Write to MongoDB
    if (documentsToInsert.length > 0) {
      try {
        await UserLogModel.insertMany(documentsToInsert, { ordered: false });
        // console.log(`[UserLogConsumer] Batch inserted ${documentsToInsert.length} logs to MongoDB.`);
      } catch (dbError: any) {
        console.error('[UserLogConsumer] Failed to insertMany:', dbError.message);
        return;
      }
    }

    // 3. Acknowledge Messages in Redis
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
