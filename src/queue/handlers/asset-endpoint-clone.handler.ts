import { Types } from 'mongoose';
import { processorAPIService } from '../../api-processor';
import { externalAPI } from '../../configDB';
import { AssetModel } from '../../models/asset.model';
import { QueueEventEnvelope } from '../event-envelope';
import { registerDomainEventHandler } from '../domain-event-consumer';

interface AssetEndpointClonePayload {
  sourceAssetId: string;
  targetAssetId: string;
}

const parsePayload = (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): AssetEndpointClonePayload => {
  const payload = envelope.payload as Partial<AssetEndpointClonePayload>;
  if (
    !payload?.sourceAssetId
    || !payload.targetAssetId
    || envelope.entity.type !== 'asset'
    || envelope.entity.id !== payload.targetAssetId
    || !envelope.actorId
    || !Types.ObjectId.isValid(payload.sourceAssetId)
    || !Types.ObjectId.isValid(payload.targetAssetId)
    || !Types.ObjectId.isValid(envelope.tenantId)
    || !Types.ObjectId.isValid(envelope.actorId)
  ) {
    throw new Error('processor.asset-endpoints.asset-cloned payload is malformed');
  }
  return payload as AssetEndpointClonePayload;
};

export const synchronizeAssetEndpointClone = async (
  sourceAssetId: string,
  targetAssetId: string,
  tenantId: string,
  actorId: string,
  deliveryId: string
): Promise<void> => {
  if (!externalAPI.URL || !externalAPI.token) {
    throw new Error('Processor API URL and service token are required');
  }

  const assets = await AssetModel.find({
    _id: { $in: [sourceAssetId, targetAssetId] },
    account_id: tenantId,
    visible: true
  }).select('_id parent_id').lean();
  const source = assets.find((asset) => String(asset._id) === sourceAssetId);
  const target = assets.find((asset) => String(asset._id) === targetAssetId);
  if (!source || !target) return;

  const endpointResult = await processorAPIService.getEndPoints(
    [sourceAssetId],
    externalAPI.token,
    actorId
  );
  const endpoints = Array.isArray(endpointResult?.data) ? endpointResult.data : [];
  for (const [index, endpoint] of endpoints.entries()) {
    await processorAPIService.createEndPoint({
      org_id: tenantId,
      point_name: endpoint.point_name,
      asset_id: targetAssetId,
      mount_location: endpoint.mount_location,
      rpm: endpoint.rpm || '',
      bsf: endpoint.bsf || '',
      ftf: endpoint.ftf || '',
      bpfo: endpoint.bpfo || '',
      bpfi: endpoint.bpfi || '',
      bearing_number: endpoint.bearing_number || '',
      parent_asset_id: target.parent_id || null
    }, actorId, externalAPI.token, `${deliveryId}:${index}`);
  }
};

export const handleAssetEndpointClone = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const payload = parsePayload(envelope);
  await synchronizeAssetEndpointClone(
    payload.sourceAssetId,
    payload.targetAssetId,
    envelope.tenantId,
    envelope.actorId!,
    envelope.eventId
  );
};

export const registerAssetEndpointCloneHandlers = (): void => {
  registerDomainEventHandler(
    'processor.asset-endpoints.asset-cloned',
    1,
    handleAssetEndpointClone
  );
};
