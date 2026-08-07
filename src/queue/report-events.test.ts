import { describe, expect, it, vi } from 'vitest';
import { createOutboxEvent } from './outbox-writer';
import { queueAssetReportPdfGeneration } from './report-events';

vi.mock('./outbox-writer', () => ({
  createOutboxEvent: vi.fn()
}));

describe('asset-report PDF event producer', () => {
  it('writes a versioned tenant event using the job id as the idempotency identity', async () => {
    const session = { id: 'pdf-session' } as any;
    await queueAssetReportPdfGeneration({
      jobId: 'b6419185-884f-43fb-8c44-8d0d6bf5ef26',
      tenantId: 'tenant-1',
      actorId: 'user-1',
      correlationId: 'request-1'
    }, session);

    expect(createOutboxEvent).toHaveBeenCalledWith({
      eventId: 'b6419185-884f-43fb-8c44-8d0d6bf5ef26',
      type: 'report.asset-pdf.generate',
      version: 1,
      tenantId: 'tenant-1',
      actorId: 'user-1',
      correlationId: 'request-1',
      entity: {
        type: 'asset-report-pdf-job',
        id: 'b6419185-884f-43fb-8c44-8d0d6bf5ef26'
      },
      payload: {
        jobId: 'b6419185-884f-43fb-8c44-8d0d6bf5ef26'
      }
    }, { session });
  });
});
