/**
 * Location CDC Change Stream Handler
 *
 * Watches the Location collection and invalidates location and
 * asset list caches (since assets are joined to locations).
 *
 * Keys invalidated:
 *   - location:{id}
 *   - location:list
 *   - asset:list  (locations are embedded in asset responses)
 */

import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';

export const watchLocations = (connection: mongoose.Connection): void => {
  if (!connection || connection.readyState !== 1) return;

  let changeStream: mongoose.mongo.ChangeStream;
  try {
    changeStream = connection.collection('locations').watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn('[CDC:Location] Change stream not available:', (err as Error).message);
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
        CacheKeys.location(accountId, docId),
        CacheKeys.locationList(accountId),
        CacheKeys.assetList(accountId),   // assets embed location data
      );
      console.debug(`[CDC:Location] Invalidated for location=${docId} account=${accountId}`);
    } catch (err) {
      console.error('[CDC:Location] Error:', err);
    }
  });

  changeStream.on('error', (err) => console.error('[CDC:Location] Stream error:', err.message));
  console.log('✅ [CDC] Location change stream active');
};
