/**
 * Notification CDC Change Stream Handler
 * Short TTL: 30s — only used for REST polling, not realtime.
 */

import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';

export const watchNotifications = (connection: mongoose.Connection): void => {
  if (!connection || connection.readyState !== 1) return;

  let changeStream: mongoose.mongo.ChangeStream;
  try {
    changeStream = connection.collection('notifications').watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn('[CDC:Notification] Change stream not available:', (err as Error).message);
    return;
  }

  changeStream.on('change', async (event: mongoose.mongo.ChangeStreamDocument) => {
    try {
      const doc = event as any;
      // Notification keys are per-user
      const userId = doc.fullDocument?.userId?.toString()
        ?? doc.updateDescription?.updatedFields?.userId?.toString();
      if (!userId) return;

      await CacheManager.del(CacheKeys.notificationList(userId));
      console.debug(`[CDC:Notification] Invalidated for user=${userId}`);
    } catch (err) {
      console.error('[CDC:Notification] Error:', err);
    }
  });

  changeStream.on('error', (err) => console.error('[CDC:Notification] Stream error:', err.message));
  console.log('✅ [CDC] Notification change stream active');
};
