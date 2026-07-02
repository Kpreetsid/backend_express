/**
 * Schedule CDC Change Stream Handler
 * Cron jobs that update ScheduleMaster automatically trigger this.
 */

import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';

export const watchSchedules = (connection: mongoose.Connection): void => {
  if (!connection || connection.readyState !== 1) return;

  let changeStream: mongoose.mongo.ChangeStream;
  try {
    changeStream = connection.collection('schedulemasters').watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn('[CDC:Schedule] Change stream not available:', (err as Error).message);
    return;
  }

  changeStream.on('change', async (event: mongoose.mongo.ChangeStreamDocument) => {
    try {
      const doc = event as any;
      const accountId = doc.fullDocument?.account_id?.toString()
        ?? doc.updateDescription?.updatedFields?.account_id?.toString();
      if (!accountId) return;

      await CacheManager.del(CacheKeys.schedule(accountId));
      console.debug(`[CDC:Schedule] Invalidated schedule:list for account=${accountId}`);
    } catch (err) {
      console.error('[CDC:Schedule] Error:', err);
    }
  });

  changeStream.on('error', (err) => console.error('[CDC:Schedule] Stream error:', err.message));
  console.log('✅ [CDC] Schedule change stream active');
};
