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
import { CacheManager } from '../cache.manager';
import { CacheKeys } from '../cache.keys';
import { BaseChangeStream } from './base.stream';

export class AssetChangeStream extends BaseChangeStream {
  constructor(connection: mongoose.Connection) {
    super(connection, 'assets');
  }

  protected async handleChange(event: any): Promise<void> {
    const accountId = this.getAccountId(event);
    const docId = this.getDocumentId(event);

    if (!accountId || !docId) return;

    const keysToDelete = [
      CacheKeys.asset(accountId, docId),
      CacheKeys.assetList(accountId),
      CacheKeys.workOrderList(accountId),
      CacheKeys.report(accountId, docId),
    ];

    await CacheManager.del(...keysToDelete);
    console.debug(`[CDC:Asset] Invalidated keys for asset=${docId} account=${accountId}`);
  }

  private getDocumentId(event: any): string | null {
    return event.documentKey?._id?.toString() ?? event.effectiveDocument?._id?.toString() ?? null;
  }

  private getAccountId(event: any): string | null {
    return event.effectiveDocument?.account_id?.toString() ?? event.updateDescription?.updatedFields?.account_id?.toString() ?? null;
  }
}

export const watchAssets = (connection: mongoose.Connection): void => {
  const stream = new AssetChangeStream(connection);
  stream.start();
};

