import { Types } from 'mongoose';
import { processorAPIService } from '../../api-processor';
import { externalAPI } from '../../configDB';
import { AssetModel } from '../../models/asset.model';
import { QueueEventEnvelope } from '../event-envelope';
import { registerDomainEventHandler } from '../domain-event-consumer';

interface EquipmentEndpointSyncPayload {
  equipmentId: string;
}

const arrayTypes = new Set(['Belt_Pulley', 'Gearbox']);
const supportedTypes = new Set([
  'Motor',
  'Flexible',
  'Rigid',
  'Belt_Pulley',
  'Gearbox',
  'Fan_Blower',
  'Pumps',
  'Compressor'
]);

const parsePayload = (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): EquipmentEndpointSyncPayload => {
  const payload = envelope.payload as Partial<EquipmentEndpointSyncPayload>;
  if (
    !payload?.equipmentId
    || envelope.entity.type !== 'equipment'
    || envelope.entity.id !== payload.equipmentId
    || !envelope.actorId
    || !Types.ObjectId.isValid(payload.equipmentId)
    || !Types.ObjectId.isValid(envelope.tenantId)
    || !Types.ObjectId.isValid(envelope.actorId)
  ) {
    throw new Error('processor.equipment-endpoints.synchronize payload is malformed');
  }
  return payload as EquipmentEndpointSyncPayload;
};

export const synchronizeEquipmentEndpoints = async (
  equipmentId: string,
  tenantId: string,
  actorId: string,
  deliveryId: string
): Promise<void> => {
  if (!externalAPI.URL || !externalAPI.token) {
    throw new Error('Processor API URL and service token are required');
  }

  const assets = await AssetModel.find({
    account_id: tenantId,
    visible: true,
    $or: [
      { _id: equipmentId },
      { top_level_asset_id: equipmentId }
    ]
  }).lean();
  const equipment = assets.find((asset) => String(asset._id) === equipmentId);
  if (!equipment) return;

  const payload: Record<string, any> = {
    Motor: {},
    Flexible: {},
    Rigid: {},
    Belt_Pulley: [],
    Gearbox: [],
    Fan_Blower: {},
    Pumps: {},
    Compressor: {}
  };
  for (const asset of assets) {
    if (String(asset._id) === equipmentId || !supportedTypes.has(asset.asset_type)) continue;
    const endpoint = {
      ...asset,
      asset_id: asset._id,
      org_id: tenantId,
      asset_timezone: equipment.asset_timezone
    };
    if (arrayTypes.has(asset.asset_type)) {
      payload[asset.asset_type].push(endpoint);
    } else {
      payload[asset.asset_type] = endpoint;
    }
  }

  await processorAPIService.createEquipmentEndPoints(
    payload,
    actorId,
    externalAPI.token,
    deliveryId
  );
};

export const handleEquipmentEndpointSync = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const payload = parsePayload(envelope);
  await synchronizeEquipmentEndpoints(
    payload.equipmentId,
    envelope.tenantId,
    envelope.actorId!,
    envelope.eventId
  );
};

export const registerEquipmentEndpointSyncHandlers = (): void => {
  registerDomainEventHandler(
    'processor.equipment-endpoints.synchronize',
    1,
    handleEquipmentEndpointSync
  );
};
