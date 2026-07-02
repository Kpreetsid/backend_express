/**
 * Role CDC Change Stream Handler
 * Invalidates role list when user role menu is updated.
 */

import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';

export const watchRoles = (connection: mongoose.Connection): void => {
  if (!connection || connection.readyState !== 1) return;

  let changeStream: mongoose.mongo.ChangeStream;
  try {
    changeStream = connection.collection('userrolemenus').watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn('[CDC:Role] Change stream not available:', (err as Error).message);
    return;
  }

  changeStream.on('change', async (event: mongoose.mongo.ChangeStreamDocument) => {
    try {
      const doc = event as any;
      const accountId = doc.fullDocument?.account_id?.toString()
        ?? doc.updateDescription?.updatedFields?.account_id?.toString();
      if (!accountId) return;

      await CacheManager.del(CacheKeys.role(accountId));
      console.debug(`[CDC:Role] Invalidated role:list for account=${accountId}`);
    } catch (err) {
      console.error('[CDC:Role] Error:', err);
    }
  });

  changeStream.on('error', (err) => console.error('[CDC:Role] Stream error:', err.message));
  console.log('✅ [CDC] Role change stream active');
};
