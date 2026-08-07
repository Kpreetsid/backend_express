import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userController } from './user.controller';
import { usersService } from './user.service';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from '../../utils/transaction.helper';

vi.mock('./user.service', () => ({
  usersService: {
    getAllUsers: vi.fn(),
    updateUserDetails: vi.fn()
  }
}));
vi.mock('../../utils/roleFilter', () => ({
  applyRoleFilter: vi.fn()
}));
vi.mock('../../utils/notification.service', () => ({
  notificationService: {
    queueAccountNotification: vi.fn(),
    notifyAccountUsers: vi.fn()
  }
}));
vi.mock('../../utils/transaction.helper', () => ({ withTransaction: vi.fn() }));

describe('user update tenant and durable notification boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const foreignAccountId = '507f1f77bcf86cd799439099';
  const actorId = '507f1f77bcf86cd799439012';
  const targetId = '507f1f77bcf86cd799439013';
  const session = { id: 'user-update-session' };

  const response = () => {
    const value: any = {
      locals: { correlationId: 'user-update-correlation' },
      status: vi.fn(),
      json: vi.fn()
    };
    value.status.mockReturnValue(value);
    return value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.mocked(applyRoleFilter).mockImplementation(async ({ baseFilter }: any) => ({
      ...baseFilter,
      account_id: accountId
    }));
    vi.mocked(notificationService.queueAccountNotification).mockResolvedValue();
  });

  it('preserves protected tenant fields and queues the event in the update transaction', async () => {
    const existing = {
      _id: targetId,
      account_id: accountId,
      createdBy: actorId,
      firstName: 'Existing',
      lastName: 'User',
      toObject() {
        return {
          _id: this._id,
          account_id: this.account_id,
          createdBy: this.createdBy,
          firstName: this.firstName,
          lastName: this.lastName
        };
      }
    };
    const updated = { ...existing, firstName: 'Updated' };
    vi.mocked(usersService.getAllUsers).mockResolvedValue([existing] as never);
    vi.mocked(usersService.updateUserDetails).mockResolvedValue(updated as never);
    const res = response();
    const next = vi.fn();

    await userController.updateUser({
      user: { _id: actorId, account_id: accountId, user_role: 'admin' },
      params: { id: targetId },
      body: {
        _id: '507f1f77bcf86cd799439088',
        account_id: foreignAccountId,
        createdBy: foreignAccountId,
        firstName: 'Updated'
      }
    } as any, res, next);

    expect(usersService.updateUserDetails).toHaveBeenCalledWith(
      targetId,
      expect.objectContaining({
        _id: targetId,
        account_id: accountId,
        createdBy: actorId,
        firstName: 'Updated',
        updatedBy: actorId
      }),
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: targetId, event: 'updated' }),
      { session, correlationId: 'user-update-correlation' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not return success when outbox persistence fails', async () => {
    const existing: any = {
      _id: targetId,
      account_id: accountId,
      createdBy: actorId,
      toObject: () => ({ _id: targetId, account_id: accountId, createdBy: actorId })
    };
    vi.mocked(usersService.getAllUsers).mockResolvedValue([existing] as never);
    vi.mocked(usersService.updateUserDetails).mockResolvedValue(existing);
    const failure = new Error('outbox unavailable');
    vi.mocked(notificationService.queueAccountNotification).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await userController.updateUser({
      user: { _id: actorId, account_id: accountId, user_role: 'admin' },
      params: { id: targetId },
      body: { firstName: 'Updated' }
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});
