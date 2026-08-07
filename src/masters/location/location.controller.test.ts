import { beforeEach, describe, expect, it, vi } from 'vitest';
import { locationController } from './location.controller';
import { locationService } from './location.service';
import { mapUserToLocationService } from '../../transaction/mapUserLocation/userLocation.service';
import { notificationService } from '../../utils/notification.service';
import { requireActiveTenantUsers } from '../../utils/tenant-users';
import { withTransaction } from '../../utils/transaction.helper';

vi.mock('./location.service', () => ({
  locationService: {
    insertLocation: vi.fn(),
    updateById: vi.fn(),
    getAllLocations: vi.fn()
  }
}));
vi.mock('../../transaction/mapUserLocation/userLocation.service', () => ({
  mapUserToLocationService: { mapUserLocationData: vi.fn() }
}));
vi.mock('../../utils/notification.service', () => ({
  notificationService: {
    queueAccountNotification: vi.fn(),
    notifyAccountUsers: vi.fn()
  }
}));
vi.mock('../../utils/tenant-users', () => ({ requireActiveTenantUsers: vi.fn() }));
vi.mock('../../utils/transaction.helper', () => ({ withTransaction: vi.fn() }));

describe('location tenant assignment and durable notification boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const foreignAccountId = '507f1f77bcf86cd799439099';
  const userId = '507f1f77bcf86cd799439012';
  const locationId = '507f1f77bcf86cd799439013';
  const assigneeId = '507f1f77bcf86cd799439014';
  const session = { id: 'location-session' };

  const response = () => {
    const value: any = {
      locals: { correlationId: 'location-correlation' },
      status: vi.fn(),
      json: vi.fn()
    };
    value.status.mockReturnValue(value);
    return value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.mocked(requireActiveTenantUsers).mockResolvedValue([assigneeId] as never);
    vi.mocked(notificationService.queueAccountNotification).mockResolvedValue();
  });

  it('creates the location, tenant mappings, and event atomically', async () => {
    const created = { _id: locationId, location_name: 'Plant A', visible: true };
    vi.mocked(locationService.insertLocation).mockResolvedValue(created as never);
    vi.mocked(mapUserToLocationService.mapUserLocationData).mockResolvedValue([] as never);
    const res = response();
    const next = vi.fn();

    await locationController.createLocation({
      user: { account_id: accountId, _id: userId },
      body: {
        location_name: 'Plant A',
        userIdList: [assigneeId],
        account_id: foreignAccountId
      }
    } as any, res, next);

    expect(requireActiveTenantUsers).toHaveBeenCalledWith([assigneeId], accountId, session);
    expect(locationService.insertLocation).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: accountId, createdBy: userId }),
      session
    );
    expect(mapUserToLocationService.mapUserLocationData).toHaveBeenCalledWith(
      locationId,
      [assigneeId],
      accountId,
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: locationId, event: 'created' }),
      { session, correlationId: 'location-correlation' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('updates location mappings and event atomically', async () => {
    const updated = { _id: locationId, location_name: 'Plant B', visible: true };
    vi.mocked(locationService.getAllLocations)
      .mockResolvedValueOnce([{ ...updated, location_name: 'Plant A' }] as never)
      .mockResolvedValueOnce([updated] as never);
    vi.mocked(locationService.updateById).mockResolvedValue(updated as never);
    const res = response();
    const next = vi.fn();

    await locationController.updateLocation({
      user: { account_id: accountId, _id: userId },
      params: { id: locationId },
      body: { location_name: 'Plant B', userIdList: [assigneeId] }
    } as any, res, next);

    expect(locationService.updateById).toHaveBeenCalledWith(
      locationId,
      expect.objectContaining({ userIdList: [assigneeId], updatedBy: userId }),
      accountId,
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: locationId, event: 'updated' }),
      { session, correlationId: 'location-correlation' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not write when an assignee is outside the tenant', async () => {
    const failure = Object.assign(new Error('foreign user'), { status: 404 });
    vi.mocked(requireActiveTenantUsers).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await locationController.createLocation({
      user: { account_id: accountId, _id: userId },
      body: { location_name: 'Plant A', userIdList: [assigneeId] }
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(locationService.insertLocation).not.toHaveBeenCalled();
    expect(notificationService.queueAccountNotification).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
