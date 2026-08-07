import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetService } from './asset.service';
import { AssetModel } from '../../models/asset.model';

vi.mock('../../models/asset.model', () => ({
  AssetModel: {
    bulkWrite: vi.fn()
  }
}));

describe('asset buzzer write scope', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const assetId = '507f1f77bcf86cd799439014';
  const outsideAssetId = '507f1f77bcf86cd799439016';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AssetModel.bulkWrite).mockResolvedValue({} as never);
  });

  it('pins every bulk update to the tenant, visible asset, and allowed identifier', async () => {
    await assetService.updateBuzzerAssetList(
      [{ id: assetId, isBuzzerActive: true }],
      { accountId, assetIds: [assetId] }
    );

    expect(AssetModel.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: {
            _id: expect.objectContaining({}),
            account_id: accountId,
            visible: true
          },
          update: { $set: { isBuzzerActive: true } }
        }
      }
    ]);
  });

  it('fails closed before bulkWrite for an identifier outside the scope', async () => {
    await expect(assetService.updateBuzzerAssetList(
      [{ id: outsideAssetId, isBuzzerActive: true }],
      { accountId, assetIds: [assetId] }
    )).rejects.toMatchObject({
      message: 'Asset is outside the authorized scope',
      status: 403
    });

    expect(AssetModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects non-boolean buzzer state before bulkWrite', async () => {
    await expect(assetService.updateBuzzerAssetList(
      [{ id: assetId, isBuzzerActive: 'true' }],
      { accountId, assetIds: [assetId] }
    )).rejects.toMatchObject({
      message: 'isBuzzerActive must be a boolean',
      status: 400
    });

    expect(AssetModel.bulkWrite).not.toHaveBeenCalled();
  });
});
