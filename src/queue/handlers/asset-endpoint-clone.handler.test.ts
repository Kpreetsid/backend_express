import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processorAPIService } from '../../api-processor';
import { AssetModel } from '../../models/asset.model';
import { registerDomainEventHandler } from '../domain-event-consumer';
import {
  handleAssetEndpointClone,
  registerAssetEndpointCloneHandlers
} from './asset-endpoint-clone.handler';

vi.mock('../../configDB', () => ({
  externalAPI: {
    URL: 'https://processor.example',
    token: 'processor-service-token'
  }
}));
vi.mock('../../api-processor', () => ({
  processorAPIService: {
    getEndPoints: vi.fn(),
    createEndPoint: vi.fn()
  }
}));
vi.mock('../../models/asset.model', () => ({
  AssetModel: { find: vi.fn() }
}));
vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn()
}));

describe('asset endpoint-clone domain-event handler', () => {
  const sourceAssetId = '507f1f77bcf86cd799439011';
  const targetAssetId = '507f1f77bcf86cd799439012';
  const tenantId = '507f1f77bcf86cd799439013';
  const actorId = '507f1f77bcf86cd799439014';
  const parentId = '507f1f77bcf86cd799439015';
  const envelope = {
    eventId: 'endpoint-clone-event-1',
    type: 'processor.asset-endpoints.asset-cloned',
    version: 1,
    tenantId,
    actorId,
    correlationId: 'endpoint-clone-correlation',
    entity: { type: 'asset', id: targetAssetId },
    timestamp: '2026-07-29T00:00:00.000Z',
    payload: { sourceAssetId, targetAssetId }
  };

  const resolveAssets = (assets: unknown[]) => {
    const lean = vi.fn().mockResolvedValue(assets);
    const select = vi.fn().mockReturnValue({ lean });
    vi.mocked(AssetModel.find).mockReturnValue({ select } as never);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAssets([
      { _id: sourceAssetId },
      { _id: targetAssetId, parent_id: parentId }
    ]);
    vi.mocked(processorAPIService.getEndPoints).mockResolvedValue({
      data: [{
        org_id: 'foreign-tenant',
        point_name: 'Drive end',
        mount_location: 'DE',
        rpm: '1450'
      }]
    });
    vi.mocked(processorAPIService.createEndPoint).mockResolvedValue(undefined);
  });

  it('tenant-checks both assets and clones endpoints with deterministic delivery keys', async () => {
    await handleAssetEndpointClone(envelope);

    expect(AssetModel.find).toHaveBeenCalledWith({
      _id: { $in: [sourceAssetId, targetAssetId] },
      account_id: tenantId,
      visible: true
    });
    expect(processorAPIService.getEndPoints).toHaveBeenCalledWith(
      [sourceAssetId],
      'processor-service-token',
      actorId
    );
    expect(processorAPIService.createEndPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: tenantId,
        asset_id: targetAssetId,
        parent_asset_id: parentId,
        point_name: 'Drive end'
      }),
      actorId,
      'processor-service-token',
      'endpoint-clone-event-1:0'
    );
  });

  it('does not call the processor when either tenant asset is unavailable', async () => {
    resolveAssets([{ _id: targetAssetId, parent_id: parentId }]);

    await expect(handleAssetEndpointClone(envelope)).resolves.toBeUndefined();
    expect(processorAPIService.getEndPoints).not.toHaveBeenCalled();
    expect(processorAPIService.createEndPoint).not.toHaveBeenCalled();
  });

  it('rejects malformed target identity before querying assets', async () => {
    await expect(handleAssetEndpointClone({
      ...envelope,
      entity: { type: 'asset', id: sourceAssetId }
    })).rejects.toThrow('malformed');

    expect(AssetModel.find).not.toHaveBeenCalled();
  });

  it('registers the exact endpoint-clone event contract', () => {
    registerAssetEndpointCloneHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'processor.asset-endpoints.asset-cloned',
      1,
      handleAssetEndpointClone
    );
  });
});
