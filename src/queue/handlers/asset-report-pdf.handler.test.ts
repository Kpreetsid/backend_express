import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storageProvider } from '../../_config/storage';
import { assetReportService } from '../../reports/asset/asset.service';
import { assetReportPdfJobService } from '../../reports/asset/asset-pdf-job.service';
import {
  registerDomainEventHandler,
  registerDomainEventTerminalFailureHandler
} from '../domain-event-consumer';
import {
  handleAssetReportPdfGeneration,
  handleAssetReportPdfTerminalFailure,
  registerAssetReportPdfHandlers
} from './asset-report-pdf.handler';

const pdfHarness = vi.hoisted(() => ({ generateAssetReportPdf: vi.fn() }));
const metricHarness = vi.hoisted(() => ({
  stopTimer: vi.fn(),
  counter: vi.fn()
}));

vi.mock('../../reports/asset/asset-pdf.service', () => ({
  PdfService: vi.fn(function () {
    return pdfHarness;
  })
}));
vi.mock('../../reports/asset/asset.service', () => ({
  assetReportService: { getAllAssetReports: vi.fn() }
}));
vi.mock('../../reports/asset/asset-pdf-job.service', () => ({
  assetReportPdfJobService: {
    requireTenantJob: vi.fn(),
    markProcessing: vi.fn(),
    markCompleted: vi.fn(),
    markRetrying: vi.fn(),
    markFailed: vi.fn()
  }
}));
vi.mock('../../_config/storage', () => ({
  storageProvider: {
    exists: vi.fn(),
    readBuffer: vi.fn(),
    upload: vi.fn()
  }
}));
vi.mock('../../configDB', () => ({
  externalAPI: { token: 'processor-service-token' }
}));
vi.mock('../../observability/metrics', () => ({
  pdfJobDuration: { startTimer: vi.fn(() => metricHarness.stopTimer) },
  pdfJobsCounter: { inc: metricHarness.counter }
}));
vi.mock('../../observability/logger', () => ({
  applicationLogger: { error: vi.fn() }
}));
vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn(),
  registerDomainEventTerminalFailureHandler: vi.fn()
}));

describe('asset-report PDF worker', () => {
  const tenantId = '507f1f77bcf86cd799439011';
  const actorId = '507f1f77bcf86cd799439012';
  const reportId = '507f1f77bcf86cd799439013';
  const jobId = 'b6419185-884f-43fb-8c44-8d0d6bf5ef26';
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const envelope = {
    eventId: jobId,
    type: 'report.asset-pdf.generate',
    version: 1,
    tenantId,
    actorId,
    correlationId: 'pdf-request',
    entity: { type: 'asset-report-pdf-job', id: jobId },
    timestamp: new Date().toISOString(),
    payload: { jobId }
  };
  const job = {
    jobId,
    accountId: tenantId,
    actorId,
    reportId,
    status: 'queued',
    requestPayload: { labels: { title: 'Report' } },
    chartImages: [{
      key: 'trend',
      title: '',
      order: 0,
      mimeType: 'image/png',
      size: png.length,
      fileName: 'chart-01.png',
      folderName: `generated-report-inputs/${tenantId}/${jobId}`,
      checksumSha256: '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6'
    }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assetReportPdfJobService.requireTenantJob).mockResolvedValue(job);
    vi.mocked(assetReportPdfJobService.markProcessing).mockResolvedValue();
    vi.mocked(assetReportPdfJobService.markCompleted).mockResolvedValue();
    vi.mocked(assetReportPdfJobService.markRetrying).mockResolvedValue();
    vi.mocked(assetReportPdfJobService.markFailed).mockResolvedValue();
    vi.mocked(assetReportService.getAllAssetReports).mockResolvedValue([{
      assetId: { asset_name: 'Pump' },
      endpointRMSData: [],
      files: []
    }] as never);
    vi.mocked(storageProvider.readBuffer).mockResolvedValue(png);
    vi.mocked(storageProvider.exists).mockResolvedValue(true);
    vi.mocked(storageProvider.upload).mockResolvedValue({
      fileName: 'Asset_Report_pump_2026-07-29.pdf',
      size: 3,
      checksumSha256: 'pdf-checksum'
    } as never);
    pdfHarness.generateAssetReportPdf.mockResolvedValue(Buffer.from('pdf'));
  });

  it('reloads tenant state, verifies snapshots, and stores the generated PDF', async () => {
    await handleAssetReportPdfGeneration(envelope);

    expect(assetReportService.getAllAssetReports).toHaveBeenCalledWith({
      _id: reportId,
      accountId: tenantId,
      visible: true
    });
    expect(pdfHarness.generateAssetReportPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        assetName: 'Pump',
        frontendChartImages: [expect.objectContaining({
          key: 'trend',
          dataUri: expect.stringMatching(/^data:image\/png;base64,/)
        })]
      }),
      'processor-service-token',
      actorId,
      tenantId
    );
    expect(storageProvider.upload).toHaveBeenCalledWith(
      Buffer.from('pdf'),
      expect.stringMatching(/^Asset_Report_pump_\d{4}-\d{2}-\d{2}\.pdf$/),
      'application/pdf',
      `generated-reports/${tenantId}/${jobId}`
    );
    expect(assetReportPdfJobService.markCompleted).toHaveBeenCalledWith(
      jobId,
      tenantId,
      expect.objectContaining({ mimeType: 'application/pdf' })
    );
  });

  it('is idempotent when the completed tenant output still exists', async () => {
    vi.mocked(assetReportPdfJobService.requireTenantJob).mockResolvedValue({
      ...job,
      status: 'completed',
      output: { fileName: 'report.pdf', folderName: 'generated-reports/tenant/job' }
    });
    await handleAssetReportPdfGeneration(envelope);
    expect(pdfHarness.generateAssetReportPdf).not.toHaveBeenCalled();
    expect(metricHarness.counter).toHaveBeenCalledWith({ result: 'idempotent' });
  });

  it('rejects a cross-tenant job before reading report or storage state', async () => {
    vi.mocked(assetReportPdfJobService.requireTenantJob).mockResolvedValue({
      ...job,
      accountId: 'different-tenant'
    });
    await expect(handleAssetReportPdfGeneration(envelope)).rejects.toThrow('tenant');
    expect(assetReportService.getAllAssetReports).not.toHaveBeenCalled();
  });

  it('records a safe failure state and lets BullMQ retry', async () => {
    pdfHarness.generateAssetReportPdf.mockRejectedValue(new Error('browser secret detail'));
    await expect(handleAssetReportPdfGeneration(envelope)).rejects.toThrow('browser secret detail');
    expect(assetReportPdfJobService.markRetrying).toHaveBeenCalledWith(jobId, tenantId);
  });

  it('marks terminal failure only after BullMQ exhausts retries', async () => {
    await handleAssetReportPdfTerminalFailure(envelope);
    expect(assetReportPdfJobService.markFailed).toHaveBeenCalledWith(jobId, tenantId);
    expect(metricHarness.counter).toHaveBeenCalledWith({ result: 'terminal-failed' });
  });

  it('registers the exact event and terminal-failure versions', () => {
    registerAssetReportPdfHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'report.asset-pdf.generate',
      1,
      handleAssetReportPdfGeneration
    );
    expect(registerDomainEventTerminalFailureHandler).toHaveBeenCalledWith(
      'report.asset-pdf.generate',
      1,
      handleAssetReportPdfTerminalFailure
    );
  });
});
