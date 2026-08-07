import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetController } from './asset.controller';
import { assetService } from './asset.service';
import { mapUserToAssetService } from '../../transaction/mapUserAsset/userAsset.service';
import { notificationService } from '../../utils/notification.service';
import { requireActiveTenantUsers } from '../../utils/tenant-users';
import { withTransaction } from '../../utils/transaction.helper';
import { queueAssetHealthInitialization } from '../../queue/processor-events';
import { synchronizeAssetHealthInitialization } from '../../queue/handlers/asset-health-initialization.handler';

vi.mock('./asset.service', () => ({
  assetService: {
    getAllAssets: vi.fn(),
    requireTenantReferences: vi.fn(),
    createAssetOld: vi.fn(),
    updateAssetOld: vi.fn(),
    updateAllChildAssetsLocation: vi.fn(),
    makeAssetCopyRecursive: vi.fn(),
    buzzerAssetList: vi.fn(),
    updateBuzzerAssetList: vi.fn(),
    getAssetDataSensorList: vi.fn()
  }
}));
vi.mock('../../transaction/mapUserAsset/userAsset.service', () => ({
  mapUserToAssetService: {
    createMapUserAssets: vi.fn(),
    getAssetsMappedData: vi.fn()
  }
}));
vi.mock('../../utils/notification.service', () => ({
  notificationService: {
    queueAccountNotification: vi.fn(),
    notifyAccountUsers: vi.fn()
  }
}));
vi.mock('../../utils/tenant-users', () => ({ requireActiveTenantUsers: vi.fn() }));
vi.mock('../../utils/transaction.helper', () => ({ withTransaction: vi.fn() }));
vi.mock('../../queue/processor-events', () => ({
  queueAssetHealthInitialization: vi.fn()
}));
vi.mock('../../queue/handlers/asset-health-initialization.handler', () => ({
  synchronizeAssetHealthInitialization: vi.fn()
}));

describe('asset tenant and processor outbox boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const foreignAccountId = '507f1f77bcf86cd799439099';
  const userId = '507f1f77bcf86cd799439012';
  const assigneeId = '507f1f77bcf86cd799439013';
  const assetId = '507f1f77bcf86cd799439014';
  const locationId = '507f1f77bcf86cd799439015';
  const session = { id: 'asset-session' };
  const body = {
    asset_name: 'Pump A',
    asset_type: 'Pumps',
    locationId,
    userIdList: [assigneeId],
    alarmType: ['alert']
  };

  const response = () => {
    const value: any = {
      locals: { correlationId: 'asset-correlation' },
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
    vi.mocked(assetService.requireTenantReferences).mockResolvedValue();
    vi.mocked(notificationService.queueAccountNotification).mockResolvedValue();
    vi.mocked(queueAssetHealthInitialization).mockResolvedValue(true);
  });

  it('intersects a non-admin asset filter with the user mapping scope', async () => {
    const mappedAssetId = assetId;
    const outsideMappedAssetId = '507f1f77bcf86cd799439016';
    vi.mocked(mapUserToAssetService.getAssetsMappedData).mockResolvedValue([
      { assetId: mappedAssetId }
    ] as never);
    vi.mocked(assetService.getAllAssets).mockResolvedValue([
      { _id: mappedAssetId }
    ] as never);
    const res = response();
    const next = vi.fn();

    await assetController.getFilteredAssets({
      user: { account_id: accountId, _id: userId, user_role: 'manager' },
      body: { assets: [mappedAssetId, outsideMappedAssetId] }
    } as any, res, next);

    const match = vi.mocked(assetService.getAllAssets).mock.calls[0]![0];
    expect(match.account_id).toBe(accountId);
    expect(match._id.$in.map(String)).toEqual([mappedAssetId]);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not expand a requested sensor list beyond a non-admin mapping', async () => {
    const outsideMappedAssetId = '507f1f77bcf86cd799439016';
    vi.mocked(mapUserToAssetService.getAssetsMappedData).mockResolvedValue([
      { assetId }
    ] as never);
    vi.mocked(assetService.getAssetDataSensorList).mockResolvedValue([
      { id: assetId }
    ] as never);
    const res = response();
    const next = vi.fn();

    await assetController.getAssetSensorList({
      user: { account_id: accountId, _id: userId, user_role: 'manager' },
      query: { assetList: `${assetId},${outsideMappedAssetId}` }
    } as any, res, next);

    const match = vi.mocked(assetService.getAssetDataSensorList).mock.calls[0]![0];
    expect(match.account_id).toBe(accountId);
    expect(match._id.$in.map(String)).toEqual([assetId]);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects buzzer asset identifiers outside the queried tenant scope', async () => {
    const outsideScopedAssetId = '507f1f77bcf86cd799439016';
    vi.mocked(assetService.buzzerAssetList).mockResolvedValue([
      { _id: assetId, id: assetId, isBuzzerActive: false }
    ] as never);
    const res = response();
    const next = vi.fn();

    await assetController.setBuzzerAssetList({
      user: { account_id: accountId, _id: userId, user_role: 'manager' },
      params: { location_id: locationId },
      body: [{ id: outsideScopedAssetId, isBuzzerActive: true }]
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Invalid buzzer asset scope',
      status: 400
    }));
    expect(assetService.updateBuzzerAssetList).not.toHaveBeenCalled();
  });

  it('pins buzzer writes to the account and exact queried asset identifiers', async () => {
    vi.mocked(assetService.buzzerAssetList).mockResolvedValue([
      { _id: assetId, id: assetId, isBuzzerActive: false }
    ] as never);
    const body = [{ id: assetId, isBuzzerActive: true }];
    const res = response();
    const next = vi.fn();

    await assetController.setBuzzerAssetList({
      user: { account_id: accountId, _id: userId, user_role: 'manager' },
      params: { location_id: locationId },
      body
    } as any, res, next);

    expect(assetService.updateBuzzerAssetList).toHaveBeenCalledWith(body, {
      accountId,
      assetIds: [assetId]
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('creates asset, mappings, processor event, and notification atomically', async () => {
    const created = { _id: assetId, asset_name: body.asset_name };
    vi.mocked(assetService.createAssetOld).mockResolvedValue(created as never);
    vi.mocked(assetService.getAllAssets).mockResolvedValue([created] as never);
    const res = response();
    const next = vi.fn();

    await assetController.createOld({
      user: { account_id: accountId, _id: userId },
      body: {
        ...body,
        account_id: foreignAccountId,
        createdBy: '507f1f77bcf86cd799439098',
        visible: false
      }
    } as any, res, next);

    expect(assetService.createAssetOld).toHaveBeenCalledWith(
      body,
      accountId,
      userId,
      session
    );
    expect(mapUserToAssetService.createMapUserAssets).toHaveBeenCalledWith([
      expect.objectContaining({
        account_id: accountId,
        userId: assigneeId,
        assetId,
        alert: true
      })
    ], session);
    expect(queueAssetHealthInitialization).toHaveBeenCalledWith({
      assetIds: [assetId],
      tenantId: accountId,
      actorId: userId,
      correlationId: 'asset-correlation'
    }, session);
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: assetId, event: 'created' }),
      { session, correlationId: 'asset-correlation' }
    );
    expect(synchronizeAssetHealthInitialization).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('tenant-scopes an update and its mapping/notification transaction', async () => {
    const updated = { _id: assetId, asset_name: 'Pump B', locationId };
    vi.mocked(assetService.getAllAssets)
      .mockResolvedValueOnce([{ _id: assetId, locationId }] as never)
      .mockResolvedValueOnce([updated] as never);
    vi.mocked(assetService.updateAssetOld).mockResolvedValue(updated as never);
    const res = response();
    const next = vi.fn();

    await assetController.updateOld({
      user: { account_id: accountId, _id: userId },
      params: { id: assetId },
      body: { ...body, asset_name: 'Pump B', account_id: foreignAccountId }
    } as any, res, next);

    expect(assetService.updateAssetOld).toHaveBeenCalledWith(
      expect.anything(),
      { ...body, asset_name: 'Pump B', userIdList: [assigneeId] },
      accountId,
      userId,
      session
    );
    expect(notificationService.queueAccountNotification).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, entityId: assetId, event: 'updated' }),
      { session, correlationId: 'asset-correlation' }
    );
    expect(notificationService.notifyAccountUsers).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not write when any selected user is outside the tenant', async () => {
    const failure = Object.assign(new Error('foreign user'), { status: 404 });
    vi.mocked(requireActiveTenantUsers).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await assetController.createOld({
      user: { account_id: accountId, _id: userId },
      body
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(assetService.createAssetOld).not.toHaveBeenCalled();
    expect(queueAssetHealthInitialization).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses the service-token fallback only when queues are disabled', async () => {
    const created = { _id: assetId, asset_name: body.asset_name };
    vi.mocked(assetService.createAssetOld).mockResolvedValue(created as never);
    vi.mocked(assetService.getAllAssets).mockResolvedValue([created] as never);
    vi.mocked(queueAssetHealthInitialization).mockResolvedValue(false);
    vi.mocked(synchronizeAssetHealthInitialization).mockResolvedValue();
    const res = response();

    await assetController.createOld({
      user: { account_id: accountId, _id: userId },
      body
    } as any, res, vi.fn());

    expect(synchronizeAssetHealthInitialization).toHaveBeenCalledWith(
      [assetId],
      accountId,
      userId
    );
  });

  it('copies an asset hierarchy without forwarding the request bearer token', async () => {
    vi.mocked(assetService.makeAssetCopyRecursive).mockResolvedValue(assetId as never);
    vi.mocked(assetService.getAllAssets).mockResolvedValue([{ _id: assetId }] as never);
    const res = response();
    const next = vi.fn();

    await assetController.makeAssetCopy({
      user: { account_id: accountId, _id: userId },
      userToken: 'must-not-be-forwarded',
      params: { id: assetId }
    } as any, res, next);

    expect(assetService.makeAssetCopyRecursive).toHaveBeenCalledWith(
      assetId,
      userId,
      accountId,
      undefined,
      session,
      'asset-correlation'
    );
    expect(JSON.stringify(vi.mocked(assetService.makeAssetCopyRecursive).mock.calls))
      .not.toContain('must-not-be-forwarded');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });
});
