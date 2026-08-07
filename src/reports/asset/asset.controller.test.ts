import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetReportController } from './asset.controller';
import { assetReportService } from './asset.service';
import { observationService } from '../../masters/observation/observation.service';
import { withTransaction } from '../../utils/transaction.helper';
import { queueAssetReportProcessorSync } from '../../queue/processor-events';
import { synchronizeAssetReportProcessor } from '../../queue/handlers/asset-report-processor.handler';
import { assetReportPdfJobService } from './asset-pdf-job.service';

const pdfHarness = vi.hoisted(() => ({ generateAssetReportPdf: vi.fn() }));

vi.mock('./asset.service', () => ({
  assetReportService: {
    getAllAssetReports: vi.fn(),
    requireTenantReferences: vi.fn(),
    createAssetReportWithWorkOrder: vi.fn(),
    updateAssetReport: vi.fn(),
    partialUpdateAssetReport: vi.fn(),
    removeAssetReportById: vi.fn()
  }
}));
vi.mock('../../masters/observation/observation.service', () => ({
  observationService: { updateObservation: vi.fn() }
}));
vi.mock('./asset-pdf.service', () => ({
  PdfService: vi.fn(function () {
    return pdfHarness;
  })
}));
vi.mock('../../configDB', () => ({
  externalAPI: { token: 'processor-service-token' },
  storageConfig: { baseUrl: 'https://api.example' },
  assetReportPdfJobConfig: { maxRequestBytes: 1024 * 1024 }
}));
vi.mock('../../observability/logger', () => ({
  applicationLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));
vi.mock('../../utils/transaction.helper', () => ({ withTransaction: vi.fn() }));
vi.mock('../../queue/processor-events', () => ({
  queueAssetReportProcessorSync: vi.fn()
}));
vi.mock('../../queue/handlers/asset-report-processor.handler', () => ({
  synchronizeAssetReportProcessor: vi.fn()
}));
vi.mock('./asset-pdf-job.service', () => ({
  assetReportPdfJobService: {
    create: vi.fn(),
    requireTenantJob: vi.fn(),
    getDownloadUrl: vi.fn(),
    toPublicStatus: vi.fn()
  }
}));

describe('asset-report tenant and processor outbox boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const reportId = '507f1f77bcf86cd799439013';
  const assetId = '507f1f77bcf86cd799439014';
  const session = { id: 'report-session' };

  const response = () => {
    const value: any = {
      locals: { correlationId: 'report-correlation' },
      status: vi.fn(),
      json: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn()
    };
    value.status.mockReturnValue(value);
    return value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (operation: any) => operation(session));
    vi.mocked(assetReportService.requireTenantReferences).mockResolvedValue();
    vi.mocked(queueAssetReportProcessorSync).mockResolvedValue(true);
    vi.mocked(observationService.updateObservation).mockResolvedValue({} as never);
    vi.mocked(assetReportPdfJobService.toPublicStatus).mockImplementation((job: any) => ({
      jobId: job.jobId,
      status: job.status
    }));
  });

  it('creates the report, optional work order, and processor event atomically', async () => {
    const created = { _id: reportId, assetId, EquipmentHealth: '2' };
    vi.mocked(assetReportService.createAssetReportWithWorkOrder)
      .mockResolvedValue(created as never);
    const res = response();
    const next = vi.fn();

    await assetReportController.createAssetsReport({
      user: { account_id: accountId, _id: userId },
      body: {
        assetId,
        top_level_asset_id: assetId,
        files: [],
        CreateWorkRequest: 0,
        workOrder: {}
      }
    } as any, res, next);

    expect(assetReportService.createAssetReportWithWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({ assetId, CreateWorkRequest: 0 }),
      expect.objectContaining({ account_id: accountId, _id: userId }),
      0,
      {},
      'report-correlation',
      session
    );
    expect(queueAssetReportProcessorSync).toHaveBeenCalledWith({
      reportId,
      action: 'created',
      tenantId: accountId,
      actorId: userId,
      correlationId: 'report-correlation'
    }, session);
    expect(synchronizeAssetReportProcessor).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('rolls report mutation back when processor event persistence fails', async () => {
    const failure = new Error('outbox unavailable');
    vi.mocked(assetReportService.createAssetReportWithWorkOrder)
      .mockResolvedValue({ _id: reportId } as never);
    vi.mocked(queueAssetReportProcessorSync).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await assetReportController.createAssetsReport({
      user: { account_id: accountId, _id: userId },
      body: {
        assetId,
        top_level_asset_id: assetId,
        files: [],
        CreateWorkRequest: 0,
        workOrder: {}
      }
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('soft-deletes the tenant report, detaches observations, and queues one event', async () => {
    vi.mocked(assetReportService.getAllAssetReports).mockResolvedValue([{
      _id: reportId,
      accountId,
      visible: true
    }] as never);
    vi.mocked(assetReportService.removeAssetReportById)
      .mockResolvedValue({ _id: reportId, visible: false } as never);
    const res = response();

    await assetReportController.deleteAssetsReport({
      user: { account_id: accountId, _id: userId },
      params: { id: reportId }
    } as any, res, vi.fn());

    expect(observationService.updateObservation).toHaveBeenCalledWith(
      expect.objectContaining({ accountId }),
      { report_id: null, updatedBy: userId },
      session
    );
    expect(assetReportService.removeAssetReportById).toHaveBeenCalledWith(
      expect.anything(),
      accountId,
      userId,
      session
    );
    expect(queueAssetReportProcessorSync).toHaveBeenCalledWith(
      expect.objectContaining({ reportId, action: 'deleted', tenantId: accountId }),
      session
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('tenant-scopes PDF reads and uses the processor service token', async () => {
    vi.mocked(assetReportService.getAllAssetReports).mockResolvedValue([{
      _id: reportId,
      assetId: { asset_name: 'Pump', image_path: null },
      createdOn: new Date('2026-07-29T00:00:00.000Z'),
      endpointRMSData: [],
      files: []
    }] as never);
    pdfHarness.generateAssetReportPdf.mockResolvedValue(Buffer.from('pdf'));
    const res = response();
    const next = vi.fn();

    await assetReportController.generateAssetReportPdf({
      user: { account_id: accountId, _id: userId },
      userToken: 'must-not-be-forwarded',
      params: { id: reportId },
      body: {},
      files: [],
      is: vi.fn().mockReturnValue(false)
    } as any, res, next);

    expect(assetReportService.getAllAssetReports).toHaveBeenCalledWith({
      _id: expect.anything(),
      accountId,
      visible: true
    });
    expect(pdfHarness.generateAssetReportPdf).toHaveBeenCalledWith(
      expect.objectContaining({ assetName: 'Pump' }),
      'processor-service-token',
      userId,
      accountId
    );
    expect(JSON.stringify(pdfHarness.generateAssetReportPdf.mock.calls))
      .not.toContain('must-not-be-forwarded');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('pdf'));
    expect(next).not.toHaveBeenCalled();
  });

  it('tenant-scopes and queues an additive asynchronous PDF request', async () => {
    const jobId = 'b6419185-884f-43fb-8c44-8d0d6bf5ef26';
    vi.mocked(assetReportService.getAllAssetReports).mockResolvedValue([{
      _id: reportId
    }] as never);
    vi.mocked(assetReportPdfJobService.create).mockResolvedValue({
      jobId,
      status: 'queued'
    });
    const res = response();
    const next = vi.fn();

    await assetReportController.requestAssetReportPdf({
      user: { account_id: accountId, _id: userId },
      params: { id: reportId },
      body: { payload: '{}', chartManifest: '[]' },
      files: [],
      is: vi.fn().mockReturnValue(true)
    } as any, res, next);

    expect(assetReportService.getAllAssetReports).toHaveBeenCalledWith({
      _id: expect.anything(),
      accountId,
      visible: true
    });
    expect(assetReportPdfJobService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId,
        tenantId: accountId,
        actorId: userId,
        correlationId: 'report-correlation'
      })
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      status: true,
      message: 'PDF generation queued',
      data: { jobId, status: 'queued' }
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the authenticated tenant for PDF job status and signed download reads', async () => {
    const jobId = 'b6419185-884f-43fb-8c44-8d0d6bf5ef26';
    vi.mocked(assetReportPdfJobService.requireTenantJob).mockResolvedValue({
      jobId,
      status: 'completed'
    });
    vi.mocked(assetReportPdfJobService.getDownloadUrl).mockResolvedValue({
      url: 'https://signed.example/report',
      expiresIn: 300,
      fileName: 'report.pdf'
    });
    const statusResponse = response();
    const downloadResponse = response();

    await assetReportController.getAssetReportPdfJob({
      user: { account_id: accountId, _id: userId },
      params: { jobId }
    } as any, statusResponse, vi.fn());
    await assetReportController.getAssetReportPdfDownload({
      user: { account_id: accountId, _id: userId },
      params: { jobId }
    } as any, downloadResponse, vi.fn());

    expect(assetReportPdfJobService.requireTenantJob).toHaveBeenCalledWith(jobId, accountId);
    expect(assetReportPdfJobService.getDownloadUrl).toHaveBeenCalledWith(jobId, accountId);
    expect(statusResponse.status).toHaveBeenCalledWith(200);
    expect(downloadResponse.json).toHaveBeenCalledWith({
      status: true,
      message: 'PDF download URL generated successfully',
      data: {
        url: 'https://signed.example/report',
        expiresIn: 300,
        fileName: 'report.pdf'
      }
    });
  });
});
