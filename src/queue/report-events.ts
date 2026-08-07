import { ClientSession } from 'mongoose';
import { createOutboxEvent } from './outbox-writer';

export interface AssetReportPdfGenerationInput {
  jobId: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
}

export const queueAssetReportPdfGeneration = async (
  input: AssetReportPdfGenerationInput,
  session?: ClientSession
): Promise<void> => {
  await createOutboxEvent({
    eventId: input.jobId,
    type: 'report.asset-pdf.generate',
    version: 1,
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    entity: {
      type: 'asset-report-pdf-job',
      id: input.jobId
    },
    payload: {
      jobId: input.jobId
    }
  }, session ? { session } : {});
};
