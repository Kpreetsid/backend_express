/**
 * Asset CDC Change Stream Handler
 *
 * Watches the Asset collection for any insert / update / replace / delete
 * and invalidates the exact Redis keys for that tenant.
 *
 * Keys invalidated:
 *   - cmms:{env}:{accountId}:asset:{id}  — individual asset detail
 *   - cmms:{env}:{accountId}:asset:list  — account-wide list cache
 *   - cmms:{env}:{accountId}:workOrder:list — work orders reference assets
 *   - cmms:{env}:{accountId}:report:{id}  — reports reference assets
 */

import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';

export const watchAssets = (connection: mongoose.Connection): void => {
  if (!connection || connection.readyState !== 1) return;

  const collection = connection.collection('assets');

  let changeStream: mongoose.mongo.ChangeStream;
  try {
    changeStream = collection.watch([], { fullDocument: 'updateLookup' });
  } catch (err) {
    console.warn('[CDC:Asset] Change stream not available (Replica Set required):', (err as Error).message);
    return;
  }

  changeStream.on('change', async (event: mongoose.mongo.ChangeStreamDocument) => {
    try {
      const accountId = getAccountId(event);
      const docId = getDocumentId(event);

      if (!accountId || !docId) return;

      const keysToDelete = [
        CacheKeys.asset(accountId, docId),
        CacheKeys.assetList(accountId),
        CacheKeys.workOrderList(accountId),
        CacheKeys.report(accountId, docId),
      ];

      await CacheManager.del(...keysToDelete);
      console.debug(`[CDC:Asset] Invalidated keys for asset=${docId} account=${accountId}`);
    } catch (err) {
      console.error('[CDC:Asset] Error processing change event:', err);
    }
  });

  changeStream.on('error', (err) => {
    console.error('[CDC:Asset] Stream error:', err.message);
  });

  console.log('✅ [CDC] Asset change stream active');
};

function getDocumentId(event: mongoose.mongo.ChangeStreamDocument): string | null {
  const doc = event as any;
  return doc.documentKey?._id?.toString() ?? doc.fullDocument?._id?.toString() ?? null;
}

function getAccountId(event: mongoose.mongo.ChangeStreamDocument): string | null {
  const doc = event as any;
  return doc.fullDocument?.account_id?.toString() ?? doc.updateDescription?.updatedFields?.account_id?.toString() ?? null;
}
