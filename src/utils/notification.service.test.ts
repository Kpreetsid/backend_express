import { Types } from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationRepository } from '../notification/notification.service';
import { UserModel } from '../models/user.model';
import { notificationService } from './notification.service';
import { queueConfig } from '../configDB';
import { createOutboxEvent } from '../queue/outbox-writer';

vi.mock('../notification/notification.service', () => ({
  notificationRepository: {
    create: vi.fn(),
    createMany: vi.fn(),
    createManyIdempotent: vi.fn(),
    updateStatus: vi.fn()
  }
}));

vi.mock('../models/user.model', () => ({
  UserModel: {
    find: vi.fn()
  }
}));

vi.mock('../queue/outbox-writer', () => ({
  createOutboxEvent: vi.fn()
}));

describe('notification durability without a local socket server', () => {
  const originalOutboxEnabled = queueConfig.domainEventOutboxEnabled;

  beforeEach(() => {
    vi.clearAllMocks();
    queueConfig.domainEventOutboxEnabled = false;
  });

  afterEach(() => {
    queueConfig.domainEventOutboxEnabled = originalOutboxEnabled;
  });

  it('persists a user notification and leaves it Sent when no socket is initialized', async () => {
    vi.mocked(notificationRepository.create).mockResolvedValue({
      _id: new Types.ObjectId(),
      status: 'Sent',
      createdAt: new Date()
    } as never);

    await notificationService.notifyUser(
      new Types.ObjectId().toString(),
      'WORK_ORDER_CREATED',
      'Work order created',
      { workOrderId: 'wo-1' },
      new Types.ObjectId().toString()
    );

    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(notificationRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('persists account fan-out even when this API instance has no socket server', async () => {
    const userId = new Types.ObjectId();
    const select = vi.fn().mockResolvedValue([{ _id: userId }]);
    vi.mocked(UserModel.find).mockReturnValue({ select } as never);
    vi.mocked(notificationRepository.createMany).mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        targetUser: userId,
        status: 'Sent',
        createdAt: new Date()
      }
    ] as never);

    await notificationService.notifyAccountUsers({
      accountId: new Types.ObjectId().toString(),
      module: 'Work Order',
      event: 'created',
      entityId: 'wo-1',
      entityName: 'WO-1',
      actionUrl: '/work-order/wo-1'
    });

    expect(notificationRepository.createMany).toHaveBeenCalledTimes(1);
    expect(notificationRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('writes the account notification event with the business mutation session', async () => {
    queueConfig.domainEventOutboxEnabled = true;
    const session = { id: 'transaction-session' };
    vi.mocked(createOutboxEvent).mockResolvedValue({} as never);

    await notificationService.queueAccountNotification({
      accountId: 'tenant-1',
      module: 'Work Order',
      event: 'created',
      entityId: 'wo-1',
      entityName: 'WO-1',
      actionUrl: '/work-order/details/wo-1',
      sourceUserId: 'user-1'
    }, {
      session: session as never,
      correlationId: 'request-1'
    });

    expect(createOutboxEvent).toHaveBeenCalledWith({
      type: 'notification.account.requested',
      version: 1,
      tenantId: 'tenant-1',
      actorId: 'user-1',
      correlationId: 'request-1',
      entity: { type: 'work-order', id: 'wo-1' },
      payload: {
        accountId: 'tenant-1',
        module: 'Work Order',
        event: 'created',
        entityId: 'wo-1',
        entityName: 'WO-1',
        actionUrl: '/work-order/details/wo-1',
        sourceUserId: 'user-1'
      }
    }, { session });
    expect(notificationRepository.createMany).not.toHaveBeenCalled();
  });

  it('uses event-id idempotency when a queued notification is retried', async () => {
    const userId = new Types.ObjectId();
    const select = vi.fn().mockResolvedValue([{ _id: userId }]);
    vi.mocked(UserModel.find).mockReturnValue({ select } as never);
    vi.mocked(notificationRepository.createManyIdempotent).mockResolvedValue([{
      _id: new Types.ObjectId(),
      targetUser: userId,
      status: 'Sent',
      createdAt: new Date()
    }] as never);

    await notificationService.notifyAccountUsers({
      accountId: new Types.ObjectId().toString(),
      module: 'Work Order',
      event: 'created',
      entityId: 'wo-1',
      actionUrl: '/work-order/details/wo-1'
    }, 'event-1');

    expect(notificationRepository.createManyIdempotent)
      .toHaveBeenCalledWith(expect.any(Array), 'event-1');
    expect(notificationRepository.createMany).not.toHaveBeenCalled();
  });

  it('emits, marks delivery and acknowledges notifications when a socket server is available', async () => {
    const userId = new Types.ObjectId();
    const notificationId = new Types.ObjectId();
    const select = vi.fn().mockResolvedValue([{ _id: userId }]);
    vi.mocked(UserModel.find).mockReturnValue({ select } as never);
    vi.mocked(notificationRepository.createMany).mockResolvedValue([{
      _id: notificationId,
      targetUser: userId,
      status: 'Sent',
      createdAt: new Date()
    }] as never);
    vi.mocked(notificationRepository.updateStatus).mockResolvedValue({} as never);
    const io = {
      to: vi.fn(),
      emit: vi.fn()
    };
    io.to.mockReturnValue(io);
    notificationService.init(io as never);

    await notificationService.notifyCompany(
      new Types.ObjectId().toString(),
      'WORK_ORDER_UPDATED',
      'Work order updated',
      { entityId: 'wo-1' }
    );
    notificationService.broadcast('SYSTEM', 'System message', {});
    await notificationService.markAsReached(String(notificationId), String(userId));

    expect(io.to).toHaveBeenCalledWith(String(userId));
    expect(io.emit).toHaveBeenCalledWith('notification', expect.any(Object));
    expect(notificationRepository.updateStatus).toHaveBeenCalledWith(
      String(notificationId),
      'Delivered'
    );
    expect(notificationRepository.updateStatus).toHaveBeenCalledWith(
      String(notificationId),
      'Reached',
      String(userId)
    );
  });
});
