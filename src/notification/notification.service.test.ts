import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Notification } from '../models/notification.model';
import { notificationRepository } from './notification.service';

describe('notification repository idempotency', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Notification.syncIndexes();
  }, 60_000);

  afterEach(async () => {
    await Notification.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('stores only one notification per event and recipient across retries', async () => {
    const targetUser = new Types.ObjectId();
    const data = [{
      targetUser,
      account_id: new Types.ObjectId(),
      type: 'WORK_ORDER_CREATED',
      message: 'Work order created',
      metadata: { entityId: 'wo-1' }
    }];

    const first = await notificationRepository.createManyIdempotent(data, 'event-1');
    const retried = await notificationRepository.createManyIdempotent(data, 'event-1');

    expect(first).toHaveLength(1);
    expect(retried).toHaveLength(1);
    expect(String(retried[0]!._id)).toBe(String(first[0]!._id));
    await expect(Notification.countDocuments({ deliveryEventId: 'event-1' }))
      .resolves.toBe(1);
  });

  it('allows distinct events for the same recipient', async () => {
    const targetUser = new Types.ObjectId();
    const data = [{
      targetUser,
      type: 'WORK_ORDER_UPDATED',
      message: 'Work order updated',
      metadata: { entityId: 'wo-1' }
    }];

    await notificationRepository.createManyIdempotent(data, 'event-1');
    await notificationRepository.createManyIdempotent(data, 'event-2');

    await expect(Notification.countDocuments({ targetUser })).resolves.toBe(2);
  });

  it('persists standard notifications and enforces recipient-scoped status updates', async () => {
    const targetUser = new Types.ObjectId();
    const notification = await notificationRepository.create({
      targetUser,
      type: 'WORK_ORDER_CREATED',
      message: 'Work order created',
      metadata: { entityId: 'wo-1' }
    });

    expect(notification.status).toBe('Sent');
    await expect(notificationRepository.updateStatus(
      String(notification._id),
      'Delivered',
      String(new Types.ObjectId())
    )).resolves.toBeNull();

    const delivered = await notificationRepository.updateStatus(
      String(notification._id),
      'Delivered',
      String(targetUser)
    );
    expect(delivered?.status).toBe('Delivered');
    expect(delivered?.statusHistory.map((entry) => entry.status))
      .toEqual(['Sent', 'Delivered']);
  });

  it('supports bulk creation, paged reads and recipient-scoped mark-all', async () => {
    const targetUser = new Types.ObjectId();
    const otherUser = new Types.ObjectId();
    await notificationRepository.createMany([
      {
        targetUser,
        type: 'ONE',
        message: 'First',
        metadata: {}
      },
      {
        targetUser,
        type: 'TWO',
        message: 'Second',
        metadata: {}
      },
      {
        targetUser: otherUser,
        type: 'OTHER',
        message: 'Other',
        metadata: {}
      }
    ]);

    const page = await notificationRepository.getUserNotifications(
      String(targetUser),
      1,
      0
    );
    expect(page).toHaveLength(1);

    await notificationRepository.markAllAsOpened(String(targetUser));
    await expect(Notification.countDocuments({
      targetUser,
      status: 'Opened'
    })).resolves.toBe(2);
    await expect(Notification.countDocuments({
      targetUser: otherUser,
      status: 'Sent'
    })).resolves.toBe(1);
  });
});
