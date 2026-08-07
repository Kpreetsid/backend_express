import { ClientSession } from 'mongoose';
import { queueConfig } from '../configDB';
import { createOutboxEvent } from './outbox-writer';

export interface ObservationAssetHealthSyncInput {
  observationId: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
}

export interface AssetHealthInitializationInput {
  assetIds: string[];
  tenantId: string;
  actorId: string;
  correlationId: string;
}

export interface AssetEndpointCloneInput {
  sourceAssetId: string;
  targetAssetId: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
}

export interface EquipmentEndpointSyncInput {
  equipmentId: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
}

export type AssetReportProcessorAction = 'created' | 'updated' | 'completed' | 'deleted';

export interface AssetReportProcessorSyncInput {
  reportId: string;
  action: AssetReportProcessorAction;
  tenantId: string;
  actorId: string;
  correlationId: string;
}

/**
 * Persists the processor request beside the observation mutation. The boolean
 * return lets non-production deployments without queues perform the same work
 * after their local transaction has completed.
 */
export const queueObservationAssetHealthSync = async (
  input: ObservationAssetHealthSyncInput,
  session?: ClientSession
): Promise<boolean> => {
  if (!queueConfig.domainEventOutboxEnabled) return false;

  await createOutboxEvent({
    type: 'processor.asset-health.observation-upserted',
    version: 1,
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    entity: {
      type: 'observation',
      id: input.observationId
    },
    payload: {
      observationId: input.observationId
    }
  }, session ? { session } : {});

  return true;
};

export const queueAssetHealthInitialization = async (
  input: AssetHealthInitializationInput,
  session?: ClientSession
): Promise<boolean> => {
  if (!queueConfig.domainEventOutboxEnabled) return false;
  const assetIds = [...new Set(input.assetIds.map((id) => id.trim()).filter(Boolean))];
  if (!assetIds.length) throw new Error('At least one asset ID is required');

  await createOutboxEvent({
    type: 'processor.asset-health.assets-initialize',
    version: 1,
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    entity: {
      type: 'asset',
      id: assetIds[0]!
    },
    payload: { assetIds }
  }, session ? { session } : {});

  return true;
};

export const queueAssetEndpointClone = async (
  input: AssetEndpointCloneInput,
  session?: ClientSession
): Promise<boolean> => {
  if (!queueConfig.domainEventOutboxEnabled) return false;

  await createOutboxEvent({
    type: 'processor.asset-endpoints.asset-cloned',
    version: 1,
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    entity: {
      type: 'asset',
      id: input.targetAssetId
    },
    payload: {
      sourceAssetId: input.sourceAssetId,
      targetAssetId: input.targetAssetId
    }
  }, session ? { session } : {});

  return true;
};

export const queueEquipmentEndpointSync = async (
  input: EquipmentEndpointSyncInput,
  session?: ClientSession
): Promise<boolean> => {
  if (!queueConfig.domainEventOutboxEnabled) return false;

  await createOutboxEvent({
    type: 'processor.equipment-endpoints.synchronize',
    version: 1,
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    entity: {
      type: 'equipment',
      id: input.equipmentId
    },
    payload: { equipmentId: input.equipmentId }
  }, session ? { session } : {});

  return true;
};

export const queueAssetReportProcessorSync = async (
  input: AssetReportProcessorSyncInput,
  session?: ClientSession
): Promise<boolean> => {
  if (!queueConfig.domainEventOutboxEnabled) return false;

  await createOutboxEvent({
    type: 'processor.asset-report.synchronize',
    version: 1,
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    entity: {
      type: 'asset-report',
      id: input.reportId
    },
    payload: {
      reportId: input.reportId,
      action: input.action
    }
  }, session ? { session } : {});

  return true;
};
