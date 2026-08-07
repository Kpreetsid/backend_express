import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queueConfig } from '../configDB';
import { createOutboxEvent } from './outbox-writer';
import {
  queueAssetEndpointClone,
  queueAssetHealthInitialization,
  queueAssetReportProcessorSync,
  queueEquipmentEndpointSync,
  queueObservationAssetHealthSync
} from './processor-events';

vi.mock('./outbox-writer', () => ({ createOutboxEvent: vi.fn() }));

describe('processor domain-event producer', () => {
  const originalOutboxEnabled = queueConfig.domainEventOutboxEnabled;
  const input = {
    observationId: '507f1f77bcf86cd799439011',
    tenantId: '507f1f77bcf86cd799439012',
    actorId: '507f1f77bcf86cd799439013',
    correlationId: 'processor-correlation'
  };
  const session = { id: 'processor-session' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    queueConfig.domainEventOutboxEnabled = true;
    vi.mocked(createOutboxEvent).mockResolvedValue({} as never);
  });

  afterEach(() => {
    queueConfig.domainEventOutboxEnabled = originalOutboxEnabled;
  });

  it('stores only identifiers and no user credential in the versioned event', async () => {
    await expect(queueObservationAssetHealthSync(input, session)).resolves.toBe(true);

    expect(createOutboxEvent).toHaveBeenCalledWith({
      type: 'processor.asset-health.observation-upserted',
      version: 1,
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      entity: { type: 'observation', id: input.observationId },
      payload: { observationId: input.observationId }
    }, { session });
    expect(JSON.stringify(vi.mocked(createOutboxEvent).mock.calls[0]))
      .not.toMatch(/token|authorization|jwt/i);
  });

  it('reports an explicit non-production fallback when the outbox is disabled', async () => {
    queueConfig.domainEventOutboxEnabled = false;

    await expect(queueObservationAssetHealthSync(input, session)).resolves.toBe(false);
    expect(createOutboxEvent).not.toHaveBeenCalled();
  });

  it('deduplicates asset identifiers in the asset-health initialization contract', async () => {
    await expect(queueAssetHealthInitialization({
      ...input,
      assetIds: [input.observationId, input.observationId]
    }, session)).resolves.toBe(true);

    expect(createOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'processor.asset-health.assets-initialize',
        tenantId: input.tenantId,
        actorId: input.actorId,
        entity: { type: 'asset', id: input.observationId },
        payload: { assetIds: [input.observationId] }
      }),
      { session }
    );
  });

  it('rejects an empty asset-health initialization event', async () => {
    await expect(queueAssetHealthInitialization({
      ...input,
      assetIds: []
    }, session)).rejects.toThrow('At least one asset ID');
    expect(createOutboxEvent).not.toHaveBeenCalled();
  });

  it('stores source and tenant-owned target identifiers for endpoint cloning', async () => {
    const targetAssetId = '507f1f77bcf86cd799439014';
    await expect(queueAssetEndpointClone({
      sourceAssetId: input.observationId,
      targetAssetId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId
    }, session)).resolves.toBe(true);

    expect(createOutboxEvent).toHaveBeenCalledWith({
      type: 'processor.asset-endpoints.asset-cloned',
      version: 1,
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      entity: { type: 'asset', id: targetAssetId },
      payload: {
        sourceAssetId: input.observationId,
        targetAssetId
      }
    }, { session });
  });

  it('stores only the equipment identifier for current-state endpoint synchronization', async () => {
    await expect(queueEquipmentEndpointSync({
      equipmentId: input.observationId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId
    }, session)).resolves.toBe(true);

    expect(createOutboxEvent).toHaveBeenCalledWith({
      type: 'processor.equipment-endpoints.synchronize',
      version: 1,
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      entity: { type: 'equipment', id: input.observationId },
      payload: { equipmentId: input.observationId }
    }, { session });
  });

  it('stores a versioned report action without processor credentials', async () => {
    await expect(queueAssetReportProcessorSync({
      reportId: input.observationId,
      action: 'created',
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId
    }, session)).resolves.toBe(true);

    expect(createOutboxEvent).toHaveBeenCalledWith({
      type: 'processor.asset-report.synchronize',
      version: 1,
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      entity: { type: 'asset-report', id: input.observationId },
      payload: { reportId: input.observationId, action: 'created' }
    }, { session });
  });
});
