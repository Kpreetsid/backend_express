import mongoose, { Schema } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let replicaSet: MongoMemoryReplSet;

describe('MongoDB replica-set transaction safety', () => {
  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    await mongoose.connect(replicaSet.getUri(), { dbName: 'cmms_test' });
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  it('rolls back all writes when a transaction fails', async () => {
    const Fixture = mongoose.models['TransactionFixture']
      || mongoose.model('TransactionFixture', new Schema({ value: String }));
    await Fixture.deleteMany({});

    const session = await mongoose.startSession();
    await expect(session.withTransaction(async () => {
      await Fixture.create([{ value: 'must-rollback' }], { session });
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');
    await session.endSession();

    expect(await Fixture.countDocuments()).toBe(0);
  });
});
