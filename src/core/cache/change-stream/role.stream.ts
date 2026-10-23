import mongoose from 'mongoose';
import { CacheManager } from '../cache.manager';
import { CacheKeys } from '../cache.keys';
import { BaseChangeStream } from './base.stream';

export class RoleChangeStream extends BaseChangeStream {
  constructor(connection: mongoose.Connection) {
    super(connection, 'userrolemenus');
  }

  protected async handleChange(event: any): Promise<void> {
    const accountId = event.effectiveDocument?.account_id?.toString() ?? event.updateDescription?.updatedFields?.account_id?.toString();
    const docId = event.documentKey?._id?.toString() ?? event.effectiveDocument?._id?.toString();

    if (!accountId || !docId) return;

    await CacheManager.del(CacheKeys.role(accountId));
  }
}

export const watchRoles = (connection: mongoose.Connection): void => {
  new RoleChangeStream(connection).start();
};
