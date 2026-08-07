import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mapUserToAssetService } from './userAsset.service';
import { MapUserAssetLocationModel } from '../../models/mapUserLocation.model';

vi.mock('../../models/mapUserLocation.model', () => ({
  MapUserAssetLocationModel: {
    aggregate: vi.fn(),
    bulkWrite: vi.fn()
  }
}));

vi.mock('../../models/asset.model', () => ({
  AssetModel: {
    collection: { name: 'assets' }
  }
}));

vi.mock('../../models/user.model', () => ({
  UserModel: {
    collection: { name: 'users' }
  }
}));

describe('user-to-asset service tenant-safe query and update filters', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const mappingId = '507f1f77bcf86cd799439015';
  const assetId = '507f1f77bcf86cd799439014';
  const userId = '507f1f77bcf86cd799439013';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds tenant constraints to populated asset lookup', async () => {
    vi.mocked(MapUserAssetLocationModel.aggregate).mockResolvedValue([]);

    await mapUserToAssetService.userAssets(
      { userId, assetId: { $exists: true } },
      'assetId',
      accountId
    );

    const firstCall = vi.mocked(MapUserAssetLocationModel.aggregate).mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const pipeline = firstCall![0] as any[];
    expect(pipeline[1].$lookup.pipeline[0].$match).toEqual({
      $expr: { $eq: ['$_id', '$$assetId'] },
      visible: true,
      account_id: accountId
    });
  });

  it('adds tenant constraints to populated user lookup', async () => {
    vi.mocked(MapUserAssetLocationModel.aggregate).mockResolvedValue([]);

    await mapUserToAssetService.userAssets(
      { assetId, userId: { $exists: true } },
      'userId',
      accountId
    );

    const firstCall = vi.mocked(MapUserAssetLocationModel.aggregate).mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const pipeline = firstCall![0] as any[];
    expect(pipeline[1].$lookup.pipeline[0].$match).toEqual({
      $expr: { $eq: ['$_id', '$$userId'] },
      account_id: accountId
    });
  });

  it('pins mail-flag updates to the validated mapping asset and user', async () => {
    const mappings = [{ _id: mappingId, assetId, userId }];
    vi.mocked(MapUserAssetLocationModel.bulkWrite).mockResolvedValue({ modifiedCount: 1 } as never);

    await mapUserToAssetService.updateMappedUserFlags([{
      _id: mappingId,
      sendMail: true,
      alert: true,
      danger: false,
      critical: true
    }], mappings);

    expect(MapUserAssetLocationModel.bulkWrite).toHaveBeenCalledWith([{
      updateOne: {
        filter: {
          _id: expect.objectContaining({}),
          assetId,
          userId
        },
        update: {
          $set: {
            sendMail: true,
            alert: true,
            danger: false,
            critical: true
          }
        }
      }
    }]);
  });

  it('rejects a mail update that was not in the validated mapping set', async () => {
    await expect(mapUserToAssetService.updateMappedUserFlags([{
      _id: mappingId,
      sendMail: true,
      alert: true,
      danger: false,
      critical: true
    }], [])).rejects.toMatchObject({
      status: 404,
      message: 'Asset mapping not found'
    });

    expect(MapUserAssetLocationModel.bulkWrite).not.toHaveBeenCalled();
  });
});
