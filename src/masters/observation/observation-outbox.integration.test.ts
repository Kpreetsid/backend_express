import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { queueConfig } from '../../configDB';
import { ObservationModel } from '../../models/observation.model';
import { OutboxEventModel } from '../../models/outboxEvent.model';
import { queueObservationAssetHealthSync } from '../../queue/processor-events';
import { withTransaction } from '../../utils/transaction.helper';
import { observationService } from './observation.service';

let replicaSet: MongoMemoryReplSet;

describe('observation and processor outbox transaction', () => {
  const originalOutboxEnabled = queueConfig.domainEventOutboxEnabled;
  const accountId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const assetId = new Types.ObjectId();
  const locationId = new Types.ObjectId();
  const body = {
    observation: 'Bearing noise',
    recommendation: 'Inspect bearing',
    assetId,
    top_level_asset_id: assetId,
    locationId,
    status: 'Warning'
  };

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    await mongoose.connect(replicaSet.getUri(), { dbName: 'cmms_observation_outbox_test' });
    await Promise.all([ObservationModel.init(), OutboxEventModel.init()]);
    queueConfig.domainEventOutboxEnabled = true;
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      ObservationModel.deleteMany({}),
      OutboxEventModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    queueConfig.domainEventOutboxEnabled = originalOutboxEnabled;
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  it('commits the observation and processor event together', async () => {
    const created = await withTransaction(async (session) => {
      const observation = await observationService.insertObservation(
        body,
        accountId,
        userId,
        session
      );
      await queueObservationAssetHealthSync({
        observationId: String(observation._id),
        tenantId: String(accountId),
        actorId: String(userId),
        correlationId: 'observation-integration-success'
      }, session);
      return observation;
    });

    expect(await ObservationModel.countDocuments({ accountId })).toBe(1);
    const event = await OutboxEventModel.findOne({
      tenantId: String(accountId),
      type: 'processor.asset-health.observation-upserted'
    }).lean();
    expect(event).toMatchObject({
      correlationId: 'observation-integration-success',
      entity: { type: 'observation', id: String(created._id) },
      payload: { observationId: String(created._id) }
    });
  });

  it('rolls back the observation when processor event persistence cannot complete', async () => {
    await expect(withTransaction(async (session) => {
      const observation = await observationService.insertObservation(
        body,
        accountId,
        userId,
        session
      );
      await queueObservationAssetHealthSync({
        observationId: String(observation._id),
        tenantId: String(accountId),
        actorId: String(userId),
        correlationId: 'observation-integration-rollback'
      }, session);
      throw new Error('force observation rollback');
    })).rejects.toThrow('force observation rollback');

    expect(await ObservationModel.countDocuments({ accountId })).toBe(0);
    expect(await OutboxEventModel.countDocuments({ tenantId: String(accountId) })).toBe(0);
  });
});
