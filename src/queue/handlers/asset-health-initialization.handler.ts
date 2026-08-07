import { Types } from 'mongoose';
import { processorAPIService } from '../../api-processor';
import { externalAPI } from '../../configDB';
import { AssetModel } from '../../models/asset.model';
import { QueueEventEnvelope } from '../event-envelope';
import { registerDomainEventHandler } from '../domain-event-consumer';

interface AssetHealthInitializationPayload {
  assetIds: string[];
}

const parsePayload = (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): AssetHealthInitializationPayload => {
  const payload = envelope.payload as Partial<AssetHealthInitializationPayload>;
  const assetIds = Array.isArray(payload?.assetIds)
    ? [...new Set(payload.assetIds.map((id) => String(id)))]
    : [];
  if (
    !assetIds.length
    || envelope.entity.type !== 'asset'
    || envelope.entity.id !== assetIds[0]
    || !envelope.actorId
    || !Types.ObjectId.isValid(envelope.tenantId)
    || !Types.ObjectId.isValid(envelope.actorId)
    || assetIds.some((id) => !Types.ObjectId.isValid(id))
  ) {
    throw new Error('processor.asset-health.assets-initialize payload is malformed');
  }
  return { assetIds };
};

export const synchronizeAssetHealthInitialization = async (
  assetIds: string[],
  tenantId: string,
  actorId: string
): Promise<void> => {
  if (!externalAPI.URL || !externalAPI.token) {
    throw new Error('Processor API URL and service token are required');
  }

  const assets = await AssetModel.find({
    _id: { $in: assetIds },
    account_id: tenantId,
    visible: true
  }).select('_id').lean();
  if (!assets.length) return;

  await processorAPIService.setAssetHealthStatus(
    assets.map((asset) => ({ assetId: String(asset._id) })),
    tenantId,
    actorId,
    externalAPI.token
  );
};

export const handleAssetHealthInitialization = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const payload = parsePayload(envelope);
  await synchronizeAssetHealthInitialization(
    payload.assetIds,
    envelope.tenantId,
    envelope.actorId!
  );
};

export const registerAssetHealthInitializationHandlers = (): void => {
  registerDomainEventHandler(
    'processor.asset-health.assets-initialize',
    1,
    handleAssetHealthInitialization
  );
};
