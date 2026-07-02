/**
 * User CDC Change Stream Handler
 *
 * Invalidates user cache and role cache since role data
 * is linked to users.
 */

import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';

export const watchUsers = (connection: mongoose.Connection): void => {
  if (!connection || connection.readyState !== 1) return;

  let changeStream: mongoose.mongo.ChangeStream;
  try {
    changeStream = connection.collection('users').watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn('[CDC:User] Change stream not available:', (err as Error).message);
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
        CacheKeys.user(accountId, docId),
        CacheKeys.userList(accountId),
        CacheKeys.role(accountId),         // roles embed user data
      );
      console.debug(`[CDC:User] Invalidated for user=${docId} account=${accountId}`);
    } catch (err) {
      console.error('[CDC:User] Error:', err);
    }
  });

  changeStream.on('error', (err) => console.error('[CDC:User] Stream error:', err.message));
  console.log('✅ [CDC] User change stream active');
};
