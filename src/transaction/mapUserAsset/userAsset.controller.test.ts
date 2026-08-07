import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userAssetController } from './userAsset.controller';
import { mapUserToAssetService } from './userAsset.service';
import { AssetModel } from '../../models/asset.model';
import { UserModel } from '../../models/user.model';

vi.mock('./userAsset.service', () => ({
  mapUserToAssetService: {
    userAssets: vi.fn(),
    createMapUserAssets: vi.fn(),
    updateUserMapping: vi.fn(),
    getMappingsByIds: vi.fn(),
    updateMappedUserFlags: vi.fn()
  }
}));

vi.mock('../../models/asset.model', () => ({
  AssetModel: {
    find: vi.fn(),
    countDocuments: vi.fn()
  }
}));

vi.mock('../../models/user.model', () => ({
  UserModel: {
    countDocuments: vi.fn()
  }
}));

describe('user-to-asset tenant boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const actorId = '507f1f77bcf86cd799439012';
  const targetUserId = '507f1f77bcf86cd799439013';
  const assetId = '507f1f77bcf86cd799439014';
  const mappingId = '507f1f77bcf86cd799439015';

  const makeRequest = (overrides: Record<string, unknown> = {}) => ({
    user: { _id: actorId, account_id: accountId, user_role: 'admin' },
    params: {},
    query: {},
    body: {},
    ...overrides
  } as any);

  const makeResponse = () => {
    const response: any = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    return response;
  };

  const mockTenantAssets = (ids: string[] = [assetId]) => {
    const query: any = { distinct: vi.fn().mockResolvedValue(ids) };
    vi.mocked(AssetModel.find).mockReturnValue(query);
    return query;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantAssets();
    vi.mocked(AssetModel.countDocuments).mockResolvedValue(1);
    vi.mocked(UserModel.countDocuments).mockResolvedValue(1);
  });

  it('forces a non-admin read to the authenticated user and tenant assets', async () => {
    vi.mocked(mapUserToAssetService.userAssets).mockResolvedValue([{ _id: mappingId }] as never);
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.getUserAssets(
      makeRequest({
        user: { _id: actorId, account_id: accountId, user_role: 'employee' },
        query: { userId: targetUserId, assetId, populate: 'assetId' }
      }),
      response,
      next
    );

    expect(AssetModel.find).toHaveBeenCalledWith({
      account_id: accountId,
      visible: true,
      _id: { $in: [expect.objectContaining({})] }
    });
    expect(mapUserToAssetService.userAssets).toHaveBeenCalledWith(
      {
        assetId: { $in: [assetId] },
        userId: actorId
      },
      'assetId',
      accountId
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an admin read for a user outside the authenticated account', async () => {
    vi.mocked(UserModel.countDocuments).mockResolvedValue(0);
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.getUserAssets(
      makeRequest({ query: { userId: targetUserId } }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'User not found'
    }));
    expect(mapUserToAssetService.userAssets).not.toHaveBeenCalled();
  });

  it('returns not found when the tenant has no requested assets', async () => {
    mockTenantAssets([]);
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.getUserAssets(
      makeRequest({ query: { assetId } }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'No assets found'
    }));
    expect(mapUserToAssetService.userAssets).not.toHaveBeenCalled();
  });

  it('returns not found when no tenant mapping matches the read', async () => {
    vi.mocked(mapUserToAssetService.userAssets).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.getUserAssets(makeRequest(), response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'User asset mapping not found'
    }));
  });

  it('creates mappings with the authenticated account after tenant checks', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.setUserAssets(
      makeRequest({ body: [{ assetId, userId: targetUserId, account_id: 'foreign' }] }),
      response,
      next
    );

    expect(AssetModel.countDocuments).toHaveBeenCalledWith({
      _id: { $in: [expect.objectContaining({})] },
      account_id: accountId,
      visible: true
    });
    expect(UserModel.countDocuments).toHaveBeenCalledWith({
      _id: { $in: [expect.objectContaining({})] },
      account_id: accountId
    });
    expect(mapUserToAssetService.createMapUserAssets).toHaveBeenCalledWith([{
      assetId: expect.objectContaining({}),
      userId: expect.objectContaining({}),
      account_id: accountId
    }]);
    expect(response.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a mapping write when any asset is outside the account', async () => {
    vi.mocked(AssetModel.countDocuments).mockResolvedValue(0);
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.setUserAssets(
      makeRequest({ body: [{ assetId, userId: targetUserId }] }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Asset not found'
    }));
    expect(UserModel.countDocuments).not.toHaveBeenCalled();
    expect(mapUserToAssetService.createMapUserAssets).not.toHaveBeenCalled();
  });

  it('rejects an empty mapping payload', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.setUserAssets(
      makeRequest({ body: [] }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Invalid data'
    }));
    expect(AssetModel.countDocuments).not.toHaveBeenCalled();
  });

  it('updates mappings with a tenant-validated asset and user list', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.updateUserAssets(
      makeRequest({
        params: { assetId },
        body: { userIdList: [targetUserId], account_id: 'foreign' }
      }),
      response,
      next
    );

    expect(mapUserToAssetService.updateUserMapping).toHaveBeenCalledWith(
      assetId,
      [targetUserId],
      [],
      [],
      undefined,
      accountId
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an update without an asset identifier or user list', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.updateUserAssets(
      makeRequest({ body: {} }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Bad request'
    }));
    expect(AssetModel.countDocuments).not.toHaveBeenCalled();
  });

  it('rejects mail updates when a mapping points outside the tenant', async () => {
    vi.mocked(mapUserToAssetService.getMappingsByIds).mockResolvedValue([{
      _id: mappingId,
      assetId,
      userId: targetUserId
    }] as never);
    vi.mocked(AssetModel.countDocuments).mockResolvedValue(0);
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.updateSendMailFlag(
      makeRequest({
        body: [{
          _id: mappingId,
          sendMail: true,
          alert: true,
          danger: false,
          critical: true
        }]
      }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Asset not found'
    }));
    expect(mapUserToAssetService.updateMappedUserFlags).not.toHaveBeenCalled();
  });

  it('updates only validated mail flag fields for tenant mappings', async () => {
    const mappings = [{ _id: mappingId, assetId, userId: targetUserId }];
    vi.mocked(mapUserToAssetService.getMappingsByIds).mockResolvedValue(mappings as never);
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.updateSendMailFlag(
      makeRequest({
        body: [{
          _id: mappingId,
          sendMail: true,
          alert: true,
          danger: false,
          critical: true,
          account_id: 'foreign',
          assetId: '507f1f77bcf86cd799439099'
        }]
      }),
      response,
      next
    );

    expect(mapUserToAssetService.updateMappedUserFlags).toHaveBeenCalledWith([{
      _id: expect.objectContaining({}),
      sendMail: true,
      alert: true,
      danger: false,
      critical: true
    }], mappings);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an empty mail-preference payload', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.updateSendMailFlag(
      makeRequest({ body: [] }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Invalid data'
    }));
    expect(mapUserToAssetService.getMappingsByIds).not.toHaveBeenCalled();
  });

  it('rejects a mail-preference mapping ID that no longer exists', async () => {
    vi.mocked(mapUserToAssetService.getMappingsByIds).mockResolvedValue([]);
    const response = makeResponse();
    const next = vi.fn();

    await userAssetController.updateSendMailFlag(
      makeRequest({
        body: [{
          _id: mappingId,
          sendMail: true,
          alert: true,
          danger: false,
          critical: true
        }]
      }),
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: 'Asset mapping not found'
    }));
    expect(AssetModel.countDocuments).not.toHaveBeenCalled();
  });
});
