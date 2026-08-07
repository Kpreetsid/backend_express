import { externalAPI } from '../../configDB';
import { storageProvider } from '../../_config/storage';
import { applicationLogger } from '../../observability/logger';
import { pdfJobDuration, pdfJobsCounter } from '../../observability/metrics';
import { assetReportService } from '../../reports/asset/asset.service';
import { PdfService } from '../../reports/asset/asset-pdf.service';
import { assetReportPdfJobService } from '../../reports/asset/asset-pdf-job.service';
import {
  buildAssetReportPdfPayload,
  checksumChartImage,
  FrontendChartImage,
  validateChartImageBuffer
} from '../../reports/asset/asset-pdf-request';
import { QueueEventEnvelope } from '../event-envelope';
import {
  registerDomainEventHandler,
  registerDomainEventTerminalFailureHandler
} from '../domain-event-consumer';

interface AssetReportPdfPayload {
  jobId: string;
}

const pdfService = new PdfService();

const parsePayload = (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): AssetReportPdfPayload => {
  const payload = envelope.payload as Partial<AssetReportPdfPayload>;
  if (
    !payload?.jobId
    || payload.jobId !== envelope.entity.id
    || envelope.entity.type !== 'asset-report-pdf-job'
  ) {
    throw new Error('report.asset-pdf.generate payload is malformed');
  }
  return payload as AssetReportPdfPayload;
};

const loadChartImages = async (job: any): Promise<FrontendChartImage[]> => {
  const images = await Promise.all((job.chartImages || []).map(async (image: any) => {
    const buffer = await storageProvider.readBuffer(image.fileName, image.folderName);
    if (checksumChartImage(buffer) !== image.checksumSha256) {
      throw new Error(`Stored chart snapshot checksum mismatch for PDF job ${job.jobId}`);
    }
    validateChartImageBuffer(image.mimeType, buffer);
    return {
      key: image.key,
      title: image.title,
      order: image.order,
      width: image.width,
      height: image.height,
      mimeType: image.mimeType,
      size: image.size,
      dataUri: `data:${image.mimeType};base64,${buffer.toString('base64')}`
    };
  }));
  return images.sort((left, right) => left.order - right.order);
};

export const handleAssetReportPdfGeneration = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const stopTimer = pdfJobDuration.startTimer();
  const payload = parsePayload(envelope);
  const job = await assetReportPdfJobService.requireTenantJob(payload.jobId, envelope.tenantId);
  if (String(job.accountId) !== envelope.tenantId) {
    throw new Error('PDF job tenant does not match the domain event tenant');
  }

  if (job.status === 'completed' && job.output) {
    const outputExists = await storageProvider.exists(job.output.fileName, job.output.folderName);
    if (outputExists) {
      stopTimer({ result: 'idempotent' });
      pdfJobsCounter.inc({ result: 'idempotent' });
      return;
    }
  }

  try {
    await assetReportPdfJobService.markProcessing(payload.jobId, envelope.tenantId);
    const reports: any[] = await assetReportService.getAllAssetReports({
      _id: job.reportId,
      accountId: envelope.tenantId,
      visible: true
    });
    if (!reports.length) throw new Error('Queued asset report is unavailable for this tenant');
    if (!externalAPI.token) throw new Error('Processor API service token is required');

    const report = reports[0];
    const frontendChartImages = await loadChartImages(job);
    const pdfPayload = buildAssetReportPdfPayload(
      report,
      job.requestPayload || {},
      frontendChartImages
    );
    const pdfBuffer = await pdfService.generateAssetReportPdf(
      pdfPayload,
      externalAPI.token,
      String(job.actorId),
      envelope.tenantId
    );
    const assetName = String(pdfPayload['assetName'] || 'Asset');
    const cleanName = assetName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const fileName = `Asset_Report_${cleanName}_${date}.pdf`;
    const folderName = `generated-reports/${envelope.tenantId}/${payload.jobId}`;
    const stored = await storageProvider.upload(
      pdfBuffer,
      fileName,
      'application/pdf',
      folderName
    );
    await assetReportPdfJobService.markCompleted(payload.jobId, envelope.tenantId, {
      fileName: stored.fileName,
      folderName,
      mimeType: 'application/pdf',
      size: stored.size,
      checksumSha256: stored.checksumSha256
    });
    stopTimer({ result: 'completed' });
    pdfJobsCounter.inc({ result: 'completed' });
  } catch (error) {
    await assetReportPdfJobService.markRetrying(payload.jobId, envelope.tenantId)
      .catch((statusError) => applicationLogger.error({
        err: statusError,
        jobId: payload.jobId,
        tenantId: envelope.tenantId
      }, 'Failed to persist asynchronous PDF job retry state'));
    stopTimer({ result: 'failed' });
    pdfJobsCounter.inc({ result: 'failed' });
    throw error;
  }
};

export const handleAssetReportPdfTerminalFailure = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const payload = parsePayload(envelope);
  await assetReportPdfJobService.markFailed(payload.jobId, envelope.tenantId);
  pdfJobsCounter.inc({ result: 'terminal-failed' });
};

export const registerAssetReportPdfHandlers = (): void => {
  registerDomainEventHandler(
    'report.asset-pdf.generate',
    1,
    handleAssetReportPdfGeneration
  );
  registerDomainEventTerminalFailureHandler(
    'report.asset-pdf.generate',
    1,
    handleAssetReportPdfTerminalFailure
  );
};
