import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userLocationController } from './userLocation.controller';
import { mapUserToLocationService } from './userLocation.service';
import { locationService } from '../../masters/location/location.service';
import { requireActiveTenantUsers } from '../../utils/tenant-users';

vi.mock('./userLocation.service', () => ({
  mapUserToLocationService: {
    getLocationsMappedData: vi.fn(),
    userLocations: vi.fn(),
    mapUserLocations: vi.fn()
  }
}));
vi.mock('../../masters/location/location.service', () => ({
  locationService: {
    getLocationsList: vi.fn()
  }
}));
vi.mock('../../utils/tenant-users', () => ({
  requireActiveTenantUsers: vi.fn()
}));

describe('user-to-location tenant boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const actorId = '507f1f77bcf86cd799439012';
  const locationId = '507f1f77bcf86cd799439013';
  const outsideLocationId = '507f1f77bcf86cd799439014';
  const assigneeId = '507f1f77bcf86cd799439015';

  const response = () => {
    const value: any = { status: vi.fn(), json: vi.fn() };
    value.status.mockReturnValue(value);
    return value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireActiveTenantUsers).mockResolvedValue([assigneeId] as never);
    vi.mocked(mapUserToLocationService.mapUserLocations).mockResolvedValue([{}] as never);
  });

  it('scopes an admin mapping read to locations in the authenticated account', async () => {
    vi.mocked(locationService.getLocationsList).mockResolvedValue([
      { _id: locationId }
    ] as never);
    vi.mocked(mapUserToLocationService.userLocations).mockResolvedValue([
      { locationId, userId: assigneeId }
    ] as never);
    const res = response();
    const next = vi.fn();

    await userLocationController.getUserLocations({
      user: { account_id: accountId, _id: actorId, user_role: 'admin' },
      query: {}
    } as any, res, next);

    expect(mapUserToLocationService.userLocations).toHaveBeenCalledWith(
      { locationId: { $in: [locationId] } },
      { populate: 'userId' },
      accountId
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies a non-admin mapping read outside the actor location scope', async () => {
    vi.mocked(locationService.getLocationsList).mockResolvedValue([
      { _id: outsideLocationId }
    ] as never);
    vi.mocked(mapUserToLocationService.getLocationsMappedData).mockResolvedValue([
      { locationId }
    ] as never);
    const res = response();
    const next = vi.fn();

    await userLocationController.getUserLocations({
      user: { account_id: accountId, _id: actorId, user_role: 'manager' },
      query: { locationId: outsideLocationId }
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Location not found',
      status: 404
    }));
    expect(mapUserToLocationService.userLocations).not.toHaveBeenCalled();
  });

  it('rejects an assignee outside the tenant before mapping writes', async () => {
    vi.mocked(locationService.getLocationsList).mockResolvedValue([
      { _id: locationId }
    ] as never);
    const failure = Object.assign(new Error('foreign user'), { status: 404 });
    vi.mocked(requireActiveTenantUsers).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await userLocationController.setUserLocations({
      user: { account_id: accountId, _id: actorId, user_role: 'admin' },
      body: [{ locationId, userId: assigneeId }]
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(mapUserToLocationService.mapUserLocations).not.toHaveBeenCalled();
  });

  it('writes only after location and user tenant validation', async () => {
    vi.mocked(locationService.getLocationsList).mockResolvedValue([
      { _id: locationId }
    ] as never);
    const res = response();
    const next = vi.fn();

    await userLocationController.updateUserLocations({
      user: { account_id: accountId, _id: actorId, user_role: 'admin' },
      body: [{ locationId, userId: assigneeId }]
    } as any, res, next);

    expect(requireActiveTenantUsers).toHaveBeenCalledWith([assigneeId], accountId);
    expect(mapUserToLocationService.mapUserLocations).toHaveBeenCalledWith([
      {
        locationId: expect.objectContaining({}),
        userId: expect.objectContaining({})
      }
    ], accountId);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
});
