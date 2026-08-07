import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { StoredUploadMetadataModel } from '../models/storedUploadMetadata.model';
import { uploadMetadataService } from './upload-metadata.service';

describe('tenant-owned stored upload metadata', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await StoredUploadMetadataModel.syncIndexes();
  }, 60_000);

  afterEach(async () => {
    await StoredUploadMetadataModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  const input = (accountId: Types.ObjectId) => ({
    accountId: String(accountId),
    createdBy: String(new Types.ObjectId()),
    originalName: 'manual.pdf',
    fileName: 'stored-manual.pdf',
    folderName: 'documents',
    mimeType: 'application/pdf',
    size: 42,
    checksumSha256: 'a'.repeat(64),
    storageDriver: 's3' as const
  });

  it('persists immutable tenant, checksum, scan, and storage attributes idempotently', async () => {
    const accountId = new Types.ObjectId();
    await uploadMetadataService.recordUpload(input(accountId));
    await uploadMetadataService.recordUpload(input(accountId));

    const record = await StoredUploadMetadataModel.findOne({ account_id: accountId }).lean();
    expect(record).toMatchObject({
      account_id: accountId,
      storageKey: 'documents/stored-manual.pdf',
      checksumSha256: 'a'.repeat(64),
      scanStatus: 'clean',
      storageDriver: 's3',
      status: 'active'
    });
    await expect(StoredUploadMetadataModel.countDocuments({})).resolves.toBe(1);

    await StoredUploadMetadataModel.updateOne(
      { _id: record!._id },
      { $set: { originalName: 'tampered.pdf', checksumSha256: 'b'.repeat(64) } }
    );
    const unchanged = await StoredUploadMetadataModel.findById(record!._id).lean();
    expect(unchanged?.originalName).toBe('manual.pdf');
    expect(unchanged?.checksumSha256).toBe('a'.repeat(64));
  });

  it('denies key reuse and lifecycle access across tenants', async () => {
    const owner = new Types.ObjectId();
    const attacker = new Types.ObjectId();
    await uploadMetadataService.recordUpload(input(owner));

    await expect(uploadMetadataService.recordUpload(input(attacker)))
      .rejects.toMatchObject({ status: 409 });
    await expect(uploadMetadataService.assertTenantOwnership(
      String(attacker),
      'stored-manual.pdf',
      'documents'
    )).rejects.toMatchObject({ status: 403 });
  });

  it('records deletion only for the owning tenant', async () => {
    const owner = new Types.ObjectId();
    const actor = new Types.ObjectId();
    await uploadMetadataService.recordUpload(input(owner));
    await uploadMetadataService.assertTenantOwnership(
      String(owner),
      'stored-manual.pdf',
      'documents'
    );
    await uploadMetadataService.markDeleted(
      String(owner),
      'stored-manual.pdf',
      'documents',
      String(actor)
    );

    const record = await StoredUploadMetadataModel.findOne({ account_id: owner }).lean();
    expect(record?.status).toBe('deleted');
    expect(record?.deletedAt).toBeInstanceOf(Date);
    expect(String(record?.deletedBy)).toBe(String(actor));
  });

  it('allows a time-boxed legacy lifecycle operation when no metadata exists', async () => {
    await expect(uploadMetadataService.assertTenantOwnership(
      String(new Types.ObjectId()),
      'legacy.pdf',
      'documents'
    )).resolves.toBeUndefined();
  });
});
