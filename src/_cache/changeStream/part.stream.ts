/**
 * Part CDC Change Stream Handler
 */

import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';

export const watchParts = (connection: mongoose.Connection): void => {
  if (!connection || connection.readyState !== 1) return;

  let changeStream: mongoose.mongo.ChangeStream;
  try {
    changeStream = connection.collection('parts').watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn('[CDC:Part] Change stream not available:', (err as Error).message);
    return;
  }

  changeStream.on('change', async (event: mongoose.mongo.ChangeStreamDocument) => {
    try {
      const doc = event as any;
      const accountId = doc.fullDocument?.account_id?.toString()
        ?? doc.updateDescription?.updatedFields?.account_id?.toString();
      const docId = doc.documentKey?._id?.toString();
      if (!accountId || !docId) return;

      await CacheManager.del(
        CacheKeys.part(accountId, docId),
        CacheKeys.partList(accountId),
      );
      console.debug(`[CDC:Part] Invalidated for part=${docId} account=${accountId}`);
    } catch (err) {
      console.error('[CDC:Part] Error:', err);
    }
  });

  changeStream.on('error', (err) => console.error('[CDC:Part] Stream error:', err.message));
  console.log('✅ [CDC] Part change stream active');
};
