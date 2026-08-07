import { randomUUID } from 'node:crypto';
import { ClientSession } from 'mongoose';
import {
  AssetReportPdfJobModel,
  IAssetReportPdfChartImage,
  IAssetReportPdfOutput
} from '../../models/assetReportPdfJob.model';
import {
  assetReportPdfJobConfig,
  queueConfig,
  storageConfig
} from '../../configDB';
import { storageProvider } from '../../_config/storage';
import { withTransaction } from '../../utils/transaction.helper';
import { queueAssetReportPdfGeneration } from '../../queue/report-events';
import {
  checksumChartImage,
  normalizeChartManifest,
  selectPdfRequestPayload,
  validateChartImage
} from './asset-pdf-request';

export interface CreateAssetReportPdfJobInput {
  reportId: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
  body: unknown;
  files: Express.Multer.File[];
  chartManifest: unknown;
}

const retentionDate = (): Date =>
  new Date(Date.now() + assetReportPdfJobConfig.retentionDays * 24 * 60 * 60 * 1000);

const inputFolder = (tenantId: string, jobId: string): string =>
  `generated-report-inputs/${tenantId}/${jobId}`;

const extensionForMimeType = (mimeType: string): string => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  return 'svg';
};

class AssetReportPdfJobService {
  assertAvailable(): void {
    if (!queueConfig.enabled || !queueConfig.domainEventOutboxEnabled) {
      throw Object.assign(new Error('Asynchronous PDF generation is unavailable'), { status: 503 });
    }
  }

  async create(input: CreateAssetReportPdfJobInput): Promise<any> {
    this.assertAvailable();
    const jobId = randomUUID();
    const requestPayload = selectPdfRequestPayload(input.body);
    const manifest = normalizeChartManifest(input.chartManifest, input.files.length);
    input.files.forEach(validateChartImage);

    const storedImages: IAssetReportPdfChartImage[] = [];
    try {
      for (let index = 0; index < input.files.length; index += 1) {
        const file = input.files[index]!;
        const item = manifest[index]!;
        const fileName = `chart-${String(index + 1).padStart(2, '0')}.${extensionForMimeType(file.mimetype)}`;
        const folderName = inputFolder(input.tenantId, jobId);
        const stored = await storageProvider.upload(file.buffer, fileName, file.mimetype, folderName);
        storedImages.push({
          ...item,
          mimeType: file.mimetype,
          size: file.size,
          fileName: stored.fileName,
          folderName,
          checksumSha256: stored.checksumSha256 || checksumChartImage(file.buffer)
        });
      }

      return await withTransaction(async (session: ClientSession) => {
        const [job] = await AssetReportPdfJobModel.create([{
          jobId,
          accountId: input.tenantId,
          actorId: input.actorId,
          reportId: input.reportId,
          status: 'queued',
          requestPayload,
          chartImages: storedImages,
          expiresAt: retentionDate()
        }], session ? { session } : undefined);

        await queueAssetReportPdfGeneration({
          jobId,
          tenantId: input.tenantId,
          actorId: input.actorId,
          correlationId: input.correlationId
        }, session);
        return job;
      });
    } catch (error) {
      await Promise.allSettled(
        storedImages.map((image) => storageProvider.delete(image.fileName, image.folderName))
      );
      throw error;
    }
  }

  async getTenantJob(jobId: string, tenantId: string): Promise<any> {
    return AssetReportPdfJobModel.findOne({ jobId, accountId: tenantId }).lean();
  }

  async requireTenantJob(jobId: string, tenantId: string): Promise<any> {
    const job = await this.getTenantJob(jobId, tenantId);
    if (!job) throw Object.assign(new Error('PDF generation job not found'), { status: 404 });
    return job;
  }

  async markProcessing(jobId: string, tenantId: string): Promise<void> {
    await AssetReportPdfJobModel.updateOne(
      { jobId, accountId: tenantId, status: { $ne: 'completed' } },
      {
        $set: { status: 'processing', startedAt: new Date() },
        $unset: { lastError: '' }
      }
    );
  }

  async markCompleted(
    jobId: string,
    tenantId: string,
    output: IAssetReportPdfOutput
  ): Promise<void> {
    const result = await AssetReportPdfJobModel.updateOne(
      { jobId, accountId: tenantId },
      {
        $set: {
          status: 'completed',
          output,
          completedAt: new Date(),
          expiresAt: retentionDate()
        },
        $unset: { lastError: '' }
      }
    );
    if (result.matchedCount !== 1) {
      throw new Error('PDF generation job disappeared before completion');
    }
  }

  async markRetrying(jobId: string, tenantId: string): Promise<void> {
    await AssetReportPdfJobModel.updateOne(
      { jobId, accountId: tenantId, status: { $ne: 'completed' } },
      {
        $set: {
          status: 'retrying',
          lastError: 'PDF generation will be retried',
          expiresAt: retentionDate()
        }
      }
    );
  }

  async markFailed(jobId: string, tenantId: string): Promise<void> {
    await AssetReportPdfJobModel.updateOne(
      { jobId, accountId: tenantId, status: { $ne: 'completed' } },
      {
        $set: {
          status: 'failed',
          lastError: 'PDF generation failed after all retry attempts',
          expiresAt: retentionDate()
        }
      }
    );
  }

  async getDownloadUrl(jobId: string, tenantId: string): Promise<{
    url: string;
    expiresIn: number;
    fileName: string;
  }> {
    const job = await this.requireTenantJob(jobId, tenantId);
    if (job.status !== 'completed' || !job.output) {
      throw Object.assign(new Error('PDF generation is not complete'), { status: 409 });
    }
    const exists = await storageProvider.exists(job.output.fileName, job.output.folderName);
    if (!exists) {
      throw Object.assign(new Error('Generated PDF is no longer available'), { status: 410 });
    }
    const url = storageProvider.getSignedURL
      ? await storageProvider.getSignedURL(job.output.fileName, job.output.folderName)
      : storageProvider.getURL(job.output.fileName, job.output.folderName);
    return {
      url,
      expiresIn: storageConfig.signedUrlTtlSeconds,
      fileName: job.output.fileName
    };
  }

  toPublicStatus(job: any): Record<string, unknown> {
    return {
      jobId: job.jobId,
      reportId: String(job.reportId),
      status: job.status,
      downloadReady: job.status === 'completed' && Boolean(job.output),
      ...(job.lastError ? { error: job.lastError } : {}),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      expiresAt: job.expiresAt
    };
  }
}

export const assetReportPdfJobService = new AssetReportPdfJobService();
