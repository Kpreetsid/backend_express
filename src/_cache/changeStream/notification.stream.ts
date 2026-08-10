import mongoose from 'mongoose';
import { CacheManager } from '../cacheManager';
import { CacheKeys } from '../cacheKeys';
import { BaseChangeStream } from './base.stream';

export class NotificationChangeStream extends BaseChangeStream {
  constructor(connection: mongoose.Connection) {
    super(connection, 'notifications');
  }

  protected async handleChange(event: any): Promise<void> {
    const accountId = event.effectiveDocument?.account_id?.toString() ?? event.updateDescription?.updatedFields?.account_id?.toString();
    const docId = event.documentKey?._id?.toString() ?? event.effectiveDocument?._id?.toString();

    if (!accountId || !docId) return;

    await CacheManager.del(CacheKeys.notificationList(accountId));
  }
}

export const watchNotifications = (connection: mongoose.Connection): void => {
  new NotificationChangeStream(connection).start();
};
