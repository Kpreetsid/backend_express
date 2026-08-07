import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processorAPIService } from '../../api-processor';
import { ObservationModel } from '../../models/observation.model';
import { registerDomainEventHandler } from '../domain-event-consumer';
import {
  handleObservationAssetHealthSync,
  registerObservationAssetHealthHandlers
} from './observation-asset-health.handler';

vi.mock('../../configDB', () => ({
  externalAPI: {
    URL: 'https://processor.example',
    token: 'processor-service-token'
  }
}));
vi.mock('../../api-processor', () => ({
  processorAPIService: { updateAssetHealthStatus: vi.fn() }
}));
vi.mock('../../models/observation.model', () => ({
  ObservationModel: { findOne: vi.fn() }
}));
vi.mock('../../observability/logger', () => ({
  applicationLogger: { info: vi.fn() }
}));
vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn()
}));

describe('observation asset-health domain-event handler', () => {
  const observationId = '507f1f77bcf86cd799439011';
  const tenantId = '507f1f77bcf86cd799439012';
  const actorId = '507f1f77bcf86cd799439013';
  const assetId = '507f1f77bcf86cd799439014';
  const envelope = {
    eventId: 'processor-event-1',
    type: 'processor.asset-health.observation-upserted',
    version: 1,
    tenantId,
    actorId,
    correlationId: 'processor-correlation',
    entity: { type: 'observation', id: observationId },
    timestamp: '2026-07-29T00:00:00.000Z',
    payload: { observationId }
  };

  const resolveObservation = (value: unknown) => {
    const lean = vi.fn().mockResolvedValue(value);
    const select = vi.fn().mockReturnValue({ lean });
    vi.mocked(ObservationModel.findOne).mockReturnValue({ select } as never);
    return { select, lean };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolveObservation({ assetId, status: 'Warning', alarmId: 42 });
    vi.mocked(processorAPIService.updateAssetHealthStatus).mockResolvedValue(undefined);
  });

  it('reloads latest state through the envelope tenant and uses the service token', async () => {
    await handleObservationAssetHealthSync(envelope);

    expect(ObservationModel.findOne).toHaveBeenCalledWith({
      _id: observationId,
      accountId: tenantId,
      visible: true
    });
    expect(processorAPIService.updateAssetHealthStatus).toHaveBeenCalledWith(
      { assetId, status: 'Warning', alarmId: 42 },
      tenantId,
      actorId,
      'processor-service-token'
    );
  });

  it('converges retries on the latest observation state', async () => {
    await handleObservationAssetHealthSync(envelope);
    resolveObservation({ assetId, status: 'Healthy' });
    await handleObservationAssetHealthSync(envelope);

    expect(processorAPIService.updateAssetHealthStatus).toHaveBeenLastCalledWith(
      { assetId, status: 'Healthy' },
      tenantId,
      actorId,
      'processor-service-token'
    );
  });

  it('treats a deleted or obsolete tenant observation as an idempotent no-op', async () => {
    resolveObservation(null);

    await expect(handleObservationAssetHealthSync(envelope)).resolves.toBeUndefined();
    expect(processorAPIService.updateAssetHealthStatus).not.toHaveBeenCalled();
  });

  it('rejects tenant, entity, and actor mismatches before querying data', async () => {
    await expect(handleObservationAssetHealthSync({
      ...envelope,
      entity: { type: 'observation', id: '507f1f77bcf86cd799439099' }
    })).rejects.toThrow('malformed');
    await expect(handleObservationAssetHealthSync({
      ...envelope,
      actorId: undefined
    } as any)).rejects.toThrow('malformed');

    expect(ObservationModel.findOne).not.toHaveBeenCalled();
    expect(processorAPIService.updateAssetHealthStatus).not.toHaveBeenCalled();
  });

  it('registers the exact versioned processor contract', () => {
    registerObservationAssetHealthHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'processor.asset-health.observation-upserted',
      1,
      handleObservationAssetHealthSync
    );
  });
});
