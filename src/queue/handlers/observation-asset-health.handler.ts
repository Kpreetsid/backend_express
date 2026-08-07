import { Types } from 'mongoose';
import { processorAPIService } from '../../api-processor';
import { externalAPI } from '../../configDB';
import { ObservationModel } from '../../models/observation.model';
import { applicationLogger } from '../../observability/logger';
import { QueueEventEnvelope } from '../event-envelope';
import { registerDomainEventHandler } from '../domain-event-consumer';

interface ObservationAssetHealthPayload {
  observationId: string;
}

const parsePayload = (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): ObservationAssetHealthPayload => {
  const payload = envelope.payload as Partial<ObservationAssetHealthPayload>;
  if (
    !payload?.observationId
    || envelope.entity.type !== 'observation'
    || envelope.entity.id !== payload.observationId
    || !envelope.actorId
    || !Types.ObjectId.isValid(payload.observationId)
    || !Types.ObjectId.isValid(envelope.tenantId)
    || !Types.ObjectId.isValid(envelope.actorId)
  ) {
    throw new Error('processor.asset-health.observation-upserted payload is malformed');
  }
  return payload as ObservationAssetHealthPayload;
};

export const synchronizeObservationAssetHealth = async (
  observationId: string,
  tenantId: string,
  actorId: string
): Promise<void> => {
  if (!externalAPI.URL || !externalAPI.token) {
    throw new Error('Processor API URL and service token are required');
  }

  const observation = await ObservationModel.findOne({
    _id: observationId,
    accountId: tenantId,
    visible: true
  }).select('assetId status alarmId').lean();

  if (!observation) {
    applicationLogger.info(
      { observationId, tenantId },
      'Skipping obsolete observation asset-health event'
    );
    return;
  }

  await processorAPIService.updateAssetHealthStatus(
    {
      assetId: String(observation.assetId),
      status: observation.status,
      ...(observation.alarmId ? { alarmId: observation.alarmId } : {})
    },
    tenantId,
    actorId,
    externalAPI.token
  );
};

export const handleObservationAssetHealthSync = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const payload = parsePayload(envelope);
  await synchronizeObservationAssetHealth(
    payload.observationId,
    envelope.tenantId,
    envelope.actorId!
  );
};

export const registerObservationAssetHealthHandlers = (): void => {
  registerDomainEventHandler(
    'processor.asset-health.observation-upserted',
    1,
    handleObservationAssetHealthSync
  );
};
