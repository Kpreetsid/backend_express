import mongoose from 'mongoose';
import { CacheManager } from '../cache.manager';
import { CacheKeys } from '../cache.keys';
import { BaseChangeStream } from './base.stream';

export class MappingChangeStream extends BaseChangeStream {
  constructor(connection: mongoose.Connection, collectionName: string) {
    super(connection, collectionName);
  }

  protected async handleChange(event: any): Promise<void> {
    const docId = event.documentKey?._id?.toString() ?? event.effectiveDocument?._id?.toString();
    if (!docId) return;
    
    // Mappings often require account_id, assuming standard logic here
    const accountId = event.effectiveDocument?.account_id?.toString() ?? event.updateDescription?.updatedFields?.account_id?.toString();
    if(accountId) {
        await CacheManager.del(CacheKeys.assetList(accountId), CacheKeys.userList(accountId), CacheKeys.locationList(accountId));
    }
  }
}

export const watchMappings = (connection: mongoose.Connection): void => {
  ['mapuserassetlocations'].forEach(coll => {
      new MappingChangeStream(connection, coll).start();
  });
};
