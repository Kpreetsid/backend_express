import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processorAPIService } from '../../api-processor';
import { AssetModel } from '../../models/asset.model';
import { registerDomainEventHandler } from '../domain-event-consumer';
import {
  handleAssetHealthInitialization,
  registerAssetHealthInitializationHandlers
} from './asset-health-initialization.handler';

vi.mock('../../configDB', () => ({
  externalAPI: {
    URL: 'https://processor.example',
    token: 'processor-service-token'
  }
}));
vi.mock('../../api-processor', () => ({
  processorAPIService: { setAssetHealthStatus: vi.fn() }
}));
vi.mock('../../models/asset.model', () => ({
  AssetModel: { find: vi.fn() }
}));
vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn()
}));

describe('asset-health initialization domain-event handler', () => {
  const assetId = '507f1f77bcf86cd799439011';
  const deletedAssetId = '507f1f77bcf86cd799439015';
  const tenantId = '507f1f77bcf86cd799439012';
  const actorId = '507f1f77bcf86cd799439013';
  const envelope = {
    eventId: 'asset-health-event-1',
    type: 'processor.asset-health.assets-initialize',
    version: 1,
    tenantId,
    actorId,
    correlationId: 'asset-health-correlation',
    entity: { type: 'asset', id: assetId },
    timestamp: '2026-07-29T00:00:00.000Z',
    payload: { assetIds: [assetId, deletedAssetId] }
  };

  const resolveAssets = (assets: unknown[]) => {
    const lean = vi.fn().mockResolvedValue(assets);
    const select = vi.fn().mockReturnValue({ lean });
    vi.mocked(AssetModel.find).mockReturnValue({ select } as never);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAssets([{ _id: assetId }]);
    vi.mocked(processorAPIService.setAssetHealthStatus).mockResolvedValue(undefined);
  });

  it('loads only visible tenant assets and calls the processor with its service token', async () => {
    await handleAssetHealthInitialization(envelope);

    expect(AssetModel.find).toHaveBeenCalledWith({
      _id: { $in: [assetId, deletedAssetId] },
      account_id: tenantId,
      visible: true
    });
    expect(processorAPIService.setAssetHealthStatus).toHaveBeenCalledWith(
      [{ assetId }],
      tenantId,
      actorId,
      'processor-service-token'
    );
  });

  it('is an idempotent no-op when all queued assets are gone', async () => {
    resolveAssets([]);

    await expect(handleAssetHealthInitialization(envelope)).resolves.toBeUndefined();
    expect(processorAPIService.setAssetHealthStatus).not.toHaveBeenCalled();
  });

  it('rejects a malformed or mismatched tenant event before querying assets', async () => {
    await expect(handleAssetHealthInitialization({
      ...envelope,
      entity: { type: 'asset', id: deletedAssetId }
    })).rejects.toThrow('malformed');
    await expect(handleAssetHealthInitialization({
      ...envelope,
      tenantId: 'foreign-tenant'
    })).rejects.toThrow('malformed');

    expect(AssetModel.find).not.toHaveBeenCalled();
  });

  it('registers the exact asset-health event version', () => {
    registerAssetHealthInitializationHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'processor.asset-health.assets-initialize',
      1,
      handleAssetHealthInitialization
    );
  });
});
