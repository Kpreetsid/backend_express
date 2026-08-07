import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { queueConfig } from '../../configDB';
import { ReportAssetModel } from '../../models/assetReport.model';
import { OutboxEventModel } from '../../models/outboxEvent.model';
import { AssetReportPdfJobModel } from '../../models/assetReportPdfJob.model';
import { queueAssetReportProcessorSync } from '../../queue/processor-events';
import { queueAssetReportPdfGeneration } from '../../queue/report-events';
import { withTransaction } from '../../utils/transaction.helper';
import { assetReportService } from './asset.service';

vi.mock('../../work/order/order.service', () => ({
  orderService: { createWorkOrder: vi.fn() }
}));

let replicaSet: MongoMemoryReplSet;

describe('asset-report and processor outbox transaction', () => {
  const originalOutboxEnabled = queueConfig.domainEventOutboxEnabled;
  const accountId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const assetId = new Types.ObjectId();
  const user = { account_id: accountId, _id: userId };
  const body = {
    top_level_asset_id: assetId,
    assetId,
    EquipmentHealth: '2',
    files: [],
    CreateWorkRequest: '0'
  } as any;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    await mongoose.connect(replicaSet.getUri(), { dbName: 'cmms_report_outbox_test' });
    await Promise.all([
      ReportAssetModel.init(),
      OutboxEventModel.init(),
      AssetReportPdfJobModel.init()
    ]);
    queueConfig.domainEventOutboxEnabled = true;
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      ReportAssetModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
      AssetReportPdfJobModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    queueConfig.domainEventOutboxEnabled = originalOutboxEnabled;
    await mongoose.disconnect();
    await replicaSet.stop();
  });

  const createTransaction = async (forceRollback = false) => withTransaction(async (session) => {
    const report = await assetReportService.createAssetReportWithWorkOrder(
      body,
      user,
      0,
      {},
      'report-integration',
      session
    );
    await queueAssetReportProcessorSync({
      reportId: String(report._id),
      action: 'created',
      tenantId: String(accountId),
      actorId: String(userId),
      correlationId: 'report-integration'
    }, session);
    if (forceRollback) throw new Error('force report rollback');
    return report;
  });

  it('commits report and processor event together', async () => {
    const report = await createTransaction();
    expect(await ReportAssetModel.countDocuments({ accountId })).toBe(1);
    expect(await OutboxEventModel.countDocuments({
      tenantId: String(accountId),
      entity: { type: 'asset-report', id: String(report._id) }
    })).toBe(1);
  });

  it('rolls back report and processor event together', async () => {
    await expect(createTransaction(true)).rejects.toThrow('force report rollback');
    expect(await ReportAssetModel.countDocuments({ accountId })).toBe(0);
    expect(await OutboxEventModel.countDocuments({ tenantId: String(accountId) })).toBe(0);
  });

  const createPdfJobTransaction = async (forceRollback = false) => withTransaction(async (session) => {
    const jobId = 'b6419185-884f-43fb-8c44-8d0d6bf5ef26';
    await AssetReportPdfJobModel.create([{
      jobId,
      accountId,
      actorId: userId,
      reportId: new Types.ObjectId(),
      status: 'queued',
      requestPayload: { labels: {} },
      chartImages: [],
      expiresAt: new Date(Date.now() + 60_000)
    }], { session });
    await queueAssetReportPdfGeneration({
      jobId,
      tenantId: String(accountId),
      actorId: String(userId),
      correlationId: 'pdf-job-integration'
    }, session);
    if (forceRollback) throw new Error('force PDF job rollback');
    return jobId;
  });

  it('commits the PDF job and generation event together', async () => {
    const jobId = await createPdfJobTransaction();
    expect(await AssetReportPdfJobModel.countDocuments({ accountId, jobId })).toBe(1);
    expect(await OutboxEventModel.countDocuments({
      eventId: jobId,
      tenantId: String(accountId),
      type: 'report.asset-pdf.generate'
    })).toBe(1);
  });

  it('rolls back the PDF job and generation event together', async () => {
    await expect(createPdfJobTransaction(true)).rejects.toThrow('force PDF job rollback');
    expect(await AssetReportPdfJobModel.countDocuments({ accountId })).toBe(0);
    expect(await OutboxEventModel.countDocuments({
      tenantId: String(accountId),
      type: 'report.asset-pdf.generate'
    })).toBe(0);
  });
});
