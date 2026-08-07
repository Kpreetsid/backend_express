import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationController } from './notification.controller';
import { notificationRepository } from './notification.service';
import { notificationService } from '../utils/notification.service';
import { requireActiveTenantUsers } from '../utils/tenant-users';

vi.mock('./notification.service', () => ({
  notificationRepository: {
    getUserNotifications: vi.fn(),
    updateStatus: vi.fn(),
    markAllAsOpened: vi.fn()
  }
}));
vi.mock('../utils/notification.service', () => ({
  notificationService: {
    notifyUser: vi.fn()
  }
}));
vi.mock('../utils/tenant-users', () => ({
  requireActiveTenantUsers: vi.fn()
}));

describe('notification controller tenant boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const targetUserId = '507f1f77bcf86cd799439013';
  const notificationId = '507f1f77bcf86cd799439014';

  const response = () => {
    const value: any = {
      status: vi.fn(),
      json: vi.fn()
    };
    value.status.mockReturnValue(value);
    return value;
  };

  const request = (overrides: Record<string, unknown> = {}) => ({
    user: { id: userId, _id: userId, account_id: accountId },
    query: {},
    params: {},
    body: {},
    ...overrides
  } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveTenantUsers).mockResolvedValue([] as never);
    vi.mocked(notificationService.notifyUser).mockResolvedValue();
  });

  it('lists only the authenticated user notifications with default pagination', async () => {
    const notifications = [{ _id: notificationId, targetUser: userId }];
    vi.mocked(notificationRepository.getUserNotifications)
      .mockResolvedValue(notifications as never);
    const res = response();

    await notificationController.getNotifications(request(), res);

    expect(notificationRepository.getUserNotifications)
      .toHaveBeenCalledWith(userId, 50, 0);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: notifications
    });
  });

  it('preserves numeric notification pagination', async () => {
    vi.mocked(notificationRepository.getUserNotifications)
      .mockResolvedValue([] as never);

    await notificationController.getNotifications(
      request({ query: { limit: '25', skip: '50' } }),
      response()
    );

    expect(notificationRepository.getUserNotifications)
      .toHaveBeenCalledWith(userId, 25, 50);
  });

  it('returns the existing error envelope when notification listing fails', async () => {
    vi.mocked(notificationRepository.getUserNotifications)
      .mockRejectedValue(new Error('database unavailable'));
    const res = response();

    await notificationController.getNotifications(request(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'database unavailable'
    });
  });

  it('rejects an invalid notification identifier without repository access', async () => {
    const res = response();

    await notificationController.markAsOpened(request(), res);

    expect(notificationRepository.updateStatus).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid notification ID'
    });
  });

  it('marks only a notification owned by the authenticated user', async () => {
    const updated = { _id: notificationId, targetUser: userId, status: 'Opened' };
    vi.mocked(notificationRepository.updateStatus)
      .mockResolvedValue(updated as never);
    const res = response();

    await notificationController.markAsOpened(
      request({ params: { id: notificationId } }),
      res
    );

    expect(notificationRepository.updateStatus).toHaveBeenCalledWith(
      notificationId,
      'Opened',
      userId
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
  });

  it('does not expose notification ownership through a missing update', async () => {
    vi.mocked(notificationRepository.updateStatus).mockResolvedValue(null);
    const res = response();

    await notificationController.markAsOpened(
      request({ params: { id: notificationId } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Notification not found'
    });
  });

  it('preserves the status error envelope for repository failures', async () => {
    vi.mocked(notificationRepository.updateStatus)
      .mockRejectedValue(new Error('write failed'));
    const res = response();

    await notificationController.markAsOpened(
      request({ params: { id: notificationId } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'write failed'
    });
  });

  it('marks all notifications only for the authenticated user', async () => {
    const result = { acknowledged: true, modifiedCount: 2 };
    vi.mocked(notificationRepository.markAllAsOpened)
      .mockResolvedValue(result as never);
    const res = response();

    await notificationController.markAllAsOpened(request(), res);

    expect(notificationRepository.markAllAsOpened).toHaveBeenCalledWith(userId);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: result });
  });

  it('preserves the bulk status error envelope', async () => {
    vi.mocked(notificationRepository.markAllAsOpened)
      .mockRejectedValue(new Error('bulk write failed'));
    const res = response();

    await notificationController.markAllAsOpened(request(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'bulk write failed'
    });
  });

  it('sends a default test notification only to the authenticated tenant', async () => {
    const res = response();

    await notificationController.testNotification(request(), res);

    expect(requireActiveTenantUsers).toHaveBeenCalledWith([userId], accountId);
    expect(notificationService.notifyUser).toHaveBeenCalledWith(
      userId,
      'TEST_NOTIFICATION',
      'This is a test notification',
      { entityId: 'test-123' },
      accountId
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Test notification triggered'
    });
  });

  it('allows a validated active target user in the same tenant', async () => {
    await notificationController.testNotification(request({
      body: {
        userId: targetUserId,
        companyId: accountId,
        type: 'CUSTOM',
        message: 'Tenant-safe test'
      }
    }), response());

    expect(requireActiveTenantUsers)
      .toHaveBeenCalledWith([targetUserId], accountId);
    expect(notificationService.notifyUser).toHaveBeenCalledWith(
      targetUserId,
      'CUSTOM',
      'Tenant-safe test',
      { entityId: 'test-123' },
      accountId
    );
  });

  it('denies a caller-supplied foreign company before user lookup or delivery', async () => {
    const res = response();

    await notificationController.testNotification(request({
      body: {
        userId: targetUserId,
        companyId: '507f1f77bcf86cd799439099'
      }
    }), res);

    expect(requireActiveTenantUsers).not.toHaveBeenCalled();
    expect(notificationService.notifyUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Notification company does not match authenticated account'
    });
  });

  it('denies a foreign or inactive target returned by tenant validation', async () => {
    vi.mocked(requireActiveTenantUsers).mockRejectedValue(
      Object.assign(new Error('One or more users were not found in this account'), {
        status: 404
      })
    );
    const res = response();

    await notificationController.testNotification(request({
      body: { userId: targetUserId }
    }), res);

    expect(notificationService.notifyUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'One or more users were not found in this account'
    });
  });

  it('denies test delivery without authenticated tenant context', async () => {
    const res = response();

    await notificationController.testNotification(request({
      user: { id: userId }
    }), res);

    expect(requireActiveTenantUsers).not.toHaveBeenCalled();
    expect(notificationService.notifyUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authenticated account is required'
    });
  });
});
