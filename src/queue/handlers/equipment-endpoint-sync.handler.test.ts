import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processorAPIService } from '../../api-processor';
import { AssetModel } from '../../models/asset.model';
import { registerDomainEventHandler } from '../domain-event-consumer';
import {
  handleEquipmentEndpointSync,
  registerEquipmentEndpointSyncHandlers
} from './equipment-endpoint-sync.handler';

vi.mock('../../configDB', () => ({
  externalAPI: {
    URL: 'https://processor.example',
    token: 'processor-service-token'
  }
}));
vi.mock('../../api-processor', () => ({
  processorAPIService: { createEquipmentEndPoints: vi.fn() }
}));
vi.mock('../../models/asset.model', () => ({
  AssetModel: { find: vi.fn() }
}));
vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn()
}));

describe('equipment endpoint synchronization handler', () => {
  const equipmentId = '507f1f77bcf86cd799439011';
  const motorId = '507f1f77bcf86cd799439012';
  const gearboxId = '507f1f77bcf86cd799439013';
  const tenantId = '507f1f77bcf86cd799439014';
  const actorId = '507f1f77bcf86cd799439015';
  const envelope = {
    eventId: 'equipment-endpoints-event-1',
    type: 'processor.equipment-endpoints.synchronize',
    version: 1,
    tenantId,
    actorId,
    correlationId: 'equipment-correlation',
    entity: { type: 'equipment', id: equipmentId },
    timestamp: '2026-07-29T00:00:00.000Z',
    payload: { equipmentId }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AssetModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: equipmentId,
          asset_type: 'Equipment',
          asset_timezone: 'Asia/Kolkata'
        },
        { _id: motorId, asset_type: 'Motor', account_id: 'must-not-win' },
        { _id: gearboxId, asset_type: 'Gearbox' }
      ])
    } as never);
    vi.mocked(processorAPIService.createEquipmentEndPoints).mockResolvedValue(undefined);
  });

  it('rebuilds the current tenant hierarchy and uses a deterministic processor key', async () => {
    await handleEquipmentEndpointSync(envelope);

    expect(AssetModel.find).toHaveBeenCalledWith({
      account_id: tenantId,
      visible: true,
      $or: [
        { _id: equipmentId },
        { top_level_asset_id: equipmentId }
      ]
    });
    expect(processorAPIService.createEquipmentEndPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        Motor: expect.objectContaining({
          asset_id: motorId,
          org_id: tenantId,
          asset_timezone: 'Asia/Kolkata'
        }),
        Gearbox: [
          expect.objectContaining({ asset_id: gearboxId, org_id: tenantId })
        ]
      }),
      actorId,
      'processor-service-token',
      'equipment-endpoints-event-1'
    );
  });

  it('is an idempotent no-op after the tenant equipment is deleted', async () => {
    vi.mocked(AssetModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([])
    } as never);

    await expect(handleEquipmentEndpointSync(envelope)).resolves.toBeUndefined();
    expect(processorAPIService.createEquipmentEndPoints).not.toHaveBeenCalled();
  });

  it('rejects an entity mismatch before querying assets', async () => {
    await expect(handleEquipmentEndpointSync({
      ...envelope,
      entity: { type: 'equipment', id: motorId }
    })).rejects.toThrow('malformed');
    expect(AssetModel.find).not.toHaveBeenCalled();
  });

  it('registers the exact equipment endpoint event contract', () => {
    registerEquipmentEndpointSyncHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'processor.equipment-endpoints.synchronize',
      1,
      handleEquipmentEndpointSync
    );
  });
});
