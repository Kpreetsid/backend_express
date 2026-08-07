import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectionController } from './inspection.controller';
import { inspectionService } from './inspection.service';
import { mapInspectionService } from '../../transaction/mapUserInspection/userInspection.service';
import { helperService } from '../../utils/helper';
import { notificationService } from '../../utils/notification.service';
import { withTransaction } from '../../utils/transaction.helper';

vi.mock('./inspection.service', () => ({
  inspectionService: {
    createInspection: vi.fn(),
    updateInspection: vi.fn(),
    getAllInspection: vi.fn(),
    removeInspection: vi.fn()
  }
}));
vi.mock('../../transaction/mapUserInspection/userInspection.service', () => ({
  mapInspectionService: {
    getInspectionByUserId: vi.fn()
  }
}));
vi.mock('../../utils/helper', () => ({
  helperService: {
    validateObjectId: vi.fn((id: string) => ({ id, toString: () => id })),
    validateObjectIds: vi.fn((ids: string) => ids.split(','))
  }
}));
vi.mock('../../utils/notification.service', () => ({
  notificationService: {
    queueAccountNotification: vi.fn(),
    notifyAccountUsers: vi.fn()
  }
}));
vi.mock('../../utils/transaction.helper', () => ({ withTransaction: vi.fn() }));

describe('inspection durable notification boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const inspectionId = '507f1f77bcf86cd799439013';
  const session = { id: 'inspection-session' };

  const response = () => {
    const value: any = {
      locals: { correlationId: 'inspection-correlation' },
      status: vi.fn(),
      json: vi.fn()
    };
    value.status.mockReturnValue(value);
    return value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.mocked(notificationService.queueAccountNotification).mockResolvedValue();
    vi.mocked(mapInspectionService.getInspectionByUserId).mockResolvedValue([]);
  });

  it('lists tenant inspections with validated location and asset filters', async () => {
    const inspections = [{ _id: inspectionId, title: 'Monthly inspection' }];
    vi.mocked(inspectionService.getAllInspection).mockResolvedValue(inspections as never);
    const res = response();
    const next = vi.fn();

    await inspectionController.getAll({
      user: { account_id: accountId, _id: userId, user_role: 'admin' },
      query: {
        location_id: 'location-1,location-2',
        asset_id: 'asset-1'
      }
    } as any, res, next);

    expect(helperService.validateObjectIds).toHaveBeenCalledWith(
      'location-1,location-2'
    );
    expect(helperService.validateObjectIds).toHaveBeenCalledWith('asset-1');
    expect(inspectionService.getAllInspection).toHaveBeenCalledWith({
      account_id: accountId,
      visible: true,
      location_id: { $in: ['location-1', 'location-2'] },
      asset_id: { $in: ['asset-1'] }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('restricts non-admin inspection lists to mapped inspection ids', async () => {
    vi.mocked(mapInspectionService.getInspectionByUserId).mockResolvedValue([
      { inspection_id: inspectionId }
    ] as never);
    vi.mocked(inspectionService.getAllInspection).mockResolvedValue([
      { _id: inspectionId }
    ] as never);
    const res = response();
    const next = vi.fn();

    await inspectionController.getAll({
      user: {
        account_id: accountId,
        _id: userId,
        user_role: 'technician'
      },
      query: {}
    } as any, res, next);

    expect(mapInspectionService.getInspectionByUserId)
      .toHaveBeenCalledWith(accountId, userId);
    expect(inspectionService.getAllInspection).toHaveBeenCalledWith({
      account_id: accountId,
      visible: true,
      _id: { $in: [inspectionId] }
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns not found through next when no inspection is visible', async () => {
    vi.mocked(inspectionService.getAllInspection).mockResolvedValue([]);
    const res = response();
    const next = vi.fn();

    await inspectionController.getAll({
      user: { account_id: accountId, _id: userId, user_role: 'admin' },
      query: {}
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Inspection not found', status: 404 })
    );
  });

  it('reads one tenant-scoped visible inspection', async () => {
    const inspection = { _id: inspectionId, title: 'Monthly inspection' };
    vi.mocked(inspectionService.getAllInspection)
      .mockResolvedValueOnce([inspection] as never)
      .mockResolvedValueOnce([]);
    const success = response();
    const successNext = vi.fn();

    await inspectionController.getById({
      user: { account_id: accountId },
      params: { id: inspectionId }
    } as any, success, successNext);

    expect(inspectionService.getAllInspection).toHaveBeenCalledWith({
      _id: expect.objectContaining({ id: inspectionId }),
      account_id: accountId,
      visible: true
    });
    expect(success.status).toHaveBeenCalledWith(200);
    expect(successNext).not.toHaveBeenCalled();

    const missing = response();
    const missingNext = vi.fn();
    await inspectionController.getById({
      user: { account_id: accountId },
      params: { id: inspectionId }
    } as any, missing, missingNext);
    expect(missingNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Inspection not found', status: 404 })
    );
  });

  it('creates inspection, mapping, and event in one transaction', async () => {
    const created = { _id: inspectionId, title: 'Monthly inspection' };
    const result = [{ ...created, visible: true }];
    vi.mocked(inspectionService.createInspection).mockResolvedValue(created as never);
    vi.mocked(inspectionService.getAllInspection).mockResolvedValue(result as never);
    const res = response();
    const next = vi.fn();
    const handler = inspectionController.create;

    await handler({
      user: { account_id: accountId, _id: userId },
      body: { title: 'Monthly inspection' }
    } as any, res, next);

    expect(inspectionService.createInspection).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Monthly inspection' }),
      accountId,
      userId,
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: inspectionId, event: 'created' }),
      { session, correlationId: 'inspection-correlation' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails creation when persistence or the committed read is missing', async () => {
    vi.mocked(inspectionService.createInspection)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ _id: inspectionId, title: 'Inspection' } as never);
    vi.mocked(inspectionService.getAllInspection).mockResolvedValueOnce([]);

    const notCreated = response();
    const notCreatedNext = vi.fn();
    await inspectionController.create({
      user: { account_id: accountId, _id: userId },
      body: { title: 'Inspection' }
    } as any, notCreated, notCreatedNext);
    expect(notCreatedNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Inspection not created', status: 404 })
    );

    const notReadable = response();
    const notReadableNext = vi.fn();
    await inspectionController.create({
      user: { account_id: accountId, _id: userId },
      body: { title: 'Inspection' }
    } as any, notReadable, notReadableNext);
    expect(notReadableNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Inspection not found', status: 404 })
    );
  });

  it('updates inspection and event in one transaction', async () => {
    const updated = { _id: inspectionId, title: 'Updated inspection' };
    vi.mocked(inspectionService.updateInspection).mockResolvedValue(updated as never);
    vi.mocked(inspectionService.getAllInspection).mockResolvedValue([updated] as never);
    const res = response();
    const next = vi.fn();

    await inspectionController.updateById({
      user: { account_id: accountId, _id: userId },
      params: { id: inspectionId },
      body: { title: 'Updated inspection' }
    } as any, res, next);

    expect(inspectionService.updateInspection).toHaveBeenCalledWith(
      expect.objectContaining({}),
      expect.objectContaining({ title: 'Updated inspection' }),
      accountId,
      userId,
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: inspectionId, event: 'updated' }),
      { session, correlationId: 'inspection-correlation' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails update when persistence or the committed read is missing', async () => {
    vi.mocked(inspectionService.updateInspection)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ _id: inspectionId, title: 'Inspection' } as never);
    vi.mocked(inspectionService.getAllInspection).mockResolvedValueOnce([]);

    const notUpdated = response();
    const notUpdatedNext = vi.fn();
    await inspectionController.updateById({
      user: { account_id: accountId, _id: userId },
      params: { id: inspectionId },
      body: { title: 'Inspection' }
    } as any, notUpdated, notUpdatedNext);
    expect(notUpdatedNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Inspection not updated', status: 404 })
    );

    const notReadable = response();
    const notReadableNext = vi.fn();
    await inspectionController.updateById({
      user: { account_id: accountId, _id: userId },
      params: { id: inspectionId },
      body: { title: 'Inspection' }
    } as any, notReadable, notReadableNext);
    expect(notReadableNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Inspection not found', status: 404 })
    );
  });

  it('deletes only an existing tenant-scoped inspection', async () => {
    vi.mocked(inspectionService.getAllInspection).mockResolvedValue([
      { _id: inspectionId }
    ] as never);
    vi.mocked(inspectionService.removeInspection).mockResolvedValue({
      acknowledged: true
    } as never);
    const res = response();
    const next = vi.fn();

    await inspectionController.removeById({
      user: { account_id: accountId, _id: userId },
      params: { id: inspectionId }
    } as any, res, next);

    expect(inspectionService.removeInspection).toHaveBeenCalledWith(
      expect.objectContaining({ id: inspectionId }),
      accountId,
      userId
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails deletion when the inspection or delete result is missing', async () => {
    vi.mocked(inspectionService.getAllInspection)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ _id: inspectionId }] as never);
    vi.mocked(inspectionService.removeInspection).mockResolvedValueOnce(null as never);

    const missing = response();
    const missingNext = vi.fn();
    await inspectionController.removeById({
      user: { account_id: accountId, _id: userId },
      params: { id: inspectionId }
    } as any, missing, missingNext);
    expect(missingNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Inspection not found', status: 404 })
    );
    expect(inspectionService.removeInspection).not.toHaveBeenCalled();

    const notDeleted = response();
    const notDeletedNext = vi.fn();
    await inspectionController.removeById({
      user: { account_id: accountId, _id: userId },
      params: { id: inspectionId }
    } as any, notDeleted, notDeletedNext);
    expect(notDeletedNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Inspection not deleted', status: 404 })
    );
  });
});
