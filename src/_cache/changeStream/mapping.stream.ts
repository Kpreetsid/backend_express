/**
 * Mapping CDC Change Stream Handler
 *
 * Watches User↔Asset and User↔Location mapping collections.
 * When a mapping changes, the parent entity's list cache must also be cleared
 * because getAllAssets() and getAllLocations() populate userList from mappings.
 */

import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';

const watchCollection = (
  connection: mongoose.Connection,
  collectionName: string,
  label: string,
  keysToDelete: (accountId: string, userId: string) => string[]
): void => {
  let changeStream: mongoose.mongo.ChangeStream;
  try {
    changeStream = connection.collection(collectionName).watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn(`[CDC:${label}] Change stream not available:`, (err as Error).message);
    return;
  }

  changeStream.on('change', async (event: mongoose.mongo.ChangeStreamDocument) => {
    try {
      const doc = event as any;
      const accountId = doc.fullDocument?.account_id?.toString()
        ?? doc.updateDescription?.updatedFields?.account_id?.toString();
      const userId = doc.fullDocument?.userId?.toString()
        ?? doc.updateDescription?.updatedFields?.userId?.toString();
      if (!accountId) return;

      const keys = keysToDelete(accountId, userId ?? '');
      await CacheManager.del(...keys.filter(Boolean));
      console.debug(`[CDC:${label}] Invalidated ${keys.length} key(s) for account=${accountId}`);
    } catch (err) {
      console.error(`[CDC:${label}] Error:`, err);
    }
  });

  changeStream.on('error', (err) => console.error(`[CDC:${label}] Stream error:`, err.message));
  console.log(`✅ [CDC] ${label} change stream active`);
};

export const watchMappings = (connection: mongoose.Connection): void => {
  if (!connection || connection.readyState !== 1) return;

  // User↔Asset mapping — invalidate asset list for account + user mapping cache
  watchCollection(
    connection,
    'mapuserassetlocations',
    'MapUserAsset',
    (accountId, userId) => [
      CacheKeys.assetList(accountId),
      userId ? CacheKeys.userAssetMapping(userId) : '',
    ]
  );

  // User↔Location mapping — invalidate location list for account + user mapping cache
  watchCollection(
    connection,
    'mapuserassetlocations',
    'MapUserLocation',
    (accountId, userId) => [
      CacheKeys.locationList(accountId),
      userId ? CacheKeys.userLocationMapping(userId) : '',
    ]
  );
};
