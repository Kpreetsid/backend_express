import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { queueConfig } from '../../configDB';
import { storageProvider } from '../../_config/storage';
import { AssetReportPdfJobModel } from '../../models/assetReportPdfJob.model';
import { withTransaction } from '../../utils/transaction.helper';
import { queueAssetReportPdfGeneration } from '../../queue/report-events';
import { assetReportPdfJobService } from './asset-pdf-job.service';

vi.mock('../../utils/transaction.helper', () => ({ withTransaction: vi.fn() }));
vi.mock('../../queue/report-events', () => ({ queueAssetReportPdfGeneration: vi.fn() }));

describe('asset-report PDF job service', () => {
  const originalQueueEnabled = queueConfig.enabled;
  const originalOutboxEnabled = queueConfig.domainEventOutboxEnabled;
  const session = { id: 'pdf-session' };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const file = {
    fieldname: 'chartImages',
    originalname: 'chart.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: png.length,
    buffer: png
  } as Express.Multer.File;

  beforeEach(() => {
    queueConfig.enabled = true;
    queueConfig.domainEventOutboxEnabled = true;
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.spyOn(storageProvider, 'upload').mockResolvedValue({
      fileName: 'chart-01.png',
      originalName: 'chart-01.png',
      mimeType: 'image/png',
      size: png.length,
      url: 'private://chart',
      path: 'chart',
      checksumSha256: 'checksum'
    });
    vi.spyOn(storageProvider, 'delete').mockResolvedValue();
    vi.spyOn(AssetReportPdfJobModel, 'create').mockImplementation((async (documents: any[]) => [{
      ...documents[0],
      createdAt: new Date(),
      updatedAt: new Date()
    }]) as any);
    vi.mocked(queueAssetReportPdfGeneration).mockResolvedValue();
  });

  afterAll(() => {
    queueConfig.enabled = originalQueueEnabled;
    queueConfig.domainEventOutboxEnabled = originalOutboxEnabled;
  });

  const input = () => ({
    reportId: '507f1f77bcf86cd799439011',
    tenantId: '507f1f77bcf86cd799439012',
    actorId: '507f1f77bcf86cd799439013',
    correlationId: 'pdf-request',
    body: { labels: { title: 'Report' } },
    files: [file],
    chartManifest: JSON.stringify([{ key: 'trend', order: 0 }])
  });

  it('stores snapshots and commits the tenant job with its outbox event', async () => {
    const job = await assetReportPdfJobService.create(input());

    expect(storageProvider.upload).toHaveBeenCalledWith(
      png,
      'chart-01.png',
      'image/png',
      expect.stringMatching(/^generated-report-inputs\/507f1f77bcf86cd799439012\//)
    );
    expect(AssetReportPdfJobModel.create).toHaveBeenCalledWith([
      expect.objectContaining({
        accountId: input().tenantId,
        actorId: input().actorId,
        reportId: input().reportId,
        status: 'queued',
        chartImages: [expect.objectContaining({ key: 'trend' })]
      })
    ], { session });
    expect(queueAssetReportPdfGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: job.jobId,
        tenantId: input().tenantId,
        actorId: input().actorId
      }),
      session
    );
  });

  it('deletes staged snapshots when the transactional event write fails', async () => {
    vi.mocked(queueAssetReportPdfGeneration).mockRejectedValue(new Error('outbox unavailable'));
    await expect(assetReportPdfJobService.create(input())).rejects.toThrow('outbox unavailable');
    expect(storageProvider.delete).toHaveBeenCalledWith(
      'chart-01.png',
      expect.stringContaining(input().tenantId)
    );
  });

  it('rejects async requests before storage writes when queues are unavailable', async () => {
    queueConfig.enabled = false;
    await expect(assetReportPdfJobService.create(input())).rejects.toMatchObject({ status: 503 });
    expect(storageProvider.upload).not.toHaveBeenCalled();
  });

  it('returns only a tenant-scoped short-lived download URL for completed jobs', async () => {
    vi.spyOn(assetReportPdfJobService, 'requireTenantJob').mockResolvedValue({
      status: 'completed',
      output: { fileName: 'report.pdf', folderName: 'generated-reports/tenant/job' }
    });
    vi.spyOn(storageProvider, 'exists').mockResolvedValue(true);
    vi.spyOn(storageProvider, 'getURL').mockReturnValue('private://report');

    await expect(assetReportPdfJobService.getDownloadUrl('job', 'tenant')).resolves
      .toEqual(expect.objectContaining({
        url: 'private://report',
        fileName: 'report.pdf'
      }));
    expect(assetReportPdfJobService.requireTenantJob).toHaveBeenCalledWith('job', 'tenant');
  });
});
