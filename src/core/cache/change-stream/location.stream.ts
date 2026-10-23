import mongoose from 'mongoose';
import { CacheManager } from '../cache.manager';
import { CacheKeys } from '../cache.keys';
import { BaseChangeStream } from './base.stream';

export class LocationChangeStream extends BaseChangeStream {
  constructor(connection: mongoose.Connection) {
    super(connection, 'locations');
  }

  protected async handleChange(event: any): Promise<void> {
    const accountId = event.effectiveDocument?.account_id?.toString() ?? event.updateDescription?.updatedFields?.account_id?.toString();
    const docId = event.documentKey?._id?.toString() ?? event.effectiveDocument?._id?.toString();

    if (!accountId || !docId) return;

    await CacheManager.del(
      CacheKeys.location(accountId, docId),
      CacheKeys.locationList(accountId),
      CacheKeys.assetList(accountId),
    );
    console.debug(`[CDC:Location] Invalidated for location=${docId} account=${accountId}`);
  }
}

export const watchLocations = (connection: mongoose.Connection): void => {
  new LocationChangeStream(connection).start();
};
