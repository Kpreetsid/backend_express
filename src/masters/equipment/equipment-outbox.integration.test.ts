import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { queueConfig } from '../../configDB';
import { AssetModel } from '../../models/asset.model';
import { OutboxEventModel } from '../../models/outboxEvent.model';
import {
  queueAssetHealthInitialization,
  queueEquipmentEndpointSync
} from '../../queue/processor-events';
import { withTransaction } from '../../utils/transaction.helper';
import { equipmentService } from './equipment.service';

let replicaSet: MongoMemoryReplSet;

describe('equipment and processor outbox transaction', () => {
  const originalOutboxEnabled = queueConfig.domainEventOutboxEnabled;
  const accountId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const locationId = new Types.ObjectId();
  const equipmentBody = {
    asset_name: 'Pump train',
    asset_type: 'Equipment',
    asset_timezone: 'Asia/Kolkata',
    locationId
  };

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    await mongoose.connect(replicaSet.getUri(), { dbName: 'cmms_equipment_outbox_test' });
    await Promise.all([AssetModel.init(), OutboxEventModel.init()]);
    queueConfig.domainEventOutboxEnabled = true;
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([AssetModel.deleteMany({}), OutboxEventModel.deleteMany({})]);
  });

  afterAll(async () => {
    queueConfig.domainEventOutboxEnabled = originalOutboxEnabled;
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  const createTransaction = async (forceRollback = false) => withTransaction(async (session) => {
    const equipment = await equipmentService.createEquipment(
      equipmentBody,
      accountId,
      userId,
      session
    );
    const eventInput = {
      tenantId: String(accountId),
      actorId: String(userId),
      correlationId: 'equipment-integration'
    };
    await queueAssetHealthInitialization({
      ...eventInput,
      assetIds: [String(equipment._id)]
    }, session);
    await queueEquipmentEndpointSync({
      ...eventInput,
      equipmentId: String(equipment._id)
    }, session);
    if (forceRollback) throw new Error('force equipment rollback');
    return equipment;
  });

  it('commits equipment and both processor events together', async () => {
    const equipment = await createTransaction();

    expect(await AssetModel.countDocuments({ account_id: accountId })).toBe(1);
    expect(await OutboxEventModel.countDocuments({
      tenantId: String(accountId),
      entity: { type: 'asset', id: String(equipment._id) }
    })).toBe(1);
    expect(await OutboxEventModel.countDocuments({
      tenantId: String(accountId),
      entity: { type: 'equipment', id: String(equipment._id) }
    })).toBe(1);
  });

  it('rolls back equipment and processor events together', async () => {
    await expect(createTransaction(true)).rejects.toThrow('force equipment rollback');
    expect(await AssetModel.countDocuments({ account_id: accountId })).toBe(0);
    expect(await OutboxEventModel.countDocuments({ tenantId: String(accountId) })).toBe(0);
  });
});
