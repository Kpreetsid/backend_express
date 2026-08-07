import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processorAPIService } from '../../api-processor';
import { ReportAssetModel } from '../../models/assetReport.model';
import { registerDomainEventHandler } from '../domain-event-consumer';
import {
  handleAssetReportProcessorSync,
  registerAssetReportProcessorHandlers
} from './asset-report-processor.handler';

vi.mock('../../configDB', () => ({
  externalAPI: {
    URL: 'https://processor.example',
    token: 'processor-service-token'
  }
}));
vi.mock('../../api-processor', () => ({
  processorAPIService: {
    updateAssetHealthStatusOld: vi.fn(),
    updateAlarmHistoryData: vi.fn(),
    assetHealthFreezeStatus: vi.fn()
  }
}));
vi.mock('../../models/assetReport.model', () => ({
  ASSET_REPORT_STATUS: ['Open', 'On-Hold', 'In-Progress', 'Completed'],
  ReportAssetModel: {
    findOne: vi.fn(),
    countDocuments: vi.fn()
  }
}));
vi.mock('../domain-event-consumer', () => ({
  registerDomainEventHandler: vi.fn()
}));

describe('asset-report processor handler', () => {
  const reportId = '507f1f77bcf86cd799439011';
  const assetId = '507f1f77bcf86cd799439012';
  const topLevelAssetId = '507f1f77bcf86cd799439013';
  const tenantId = '507f1f77bcf86cd799439014';
  const actorId = '507f1f77bcf86cd799439015';
  const baseEnvelope = {
    eventId: 'report-event-1',
    type: 'processor.asset-report.synchronize',
    version: 1,
    tenantId,
    actorId,
    correlationId: 'report-correlation',
    entity: { type: 'asset-report', id: reportId },
    timestamp: '2026-07-29T00:00:00.000Z',
    payload: { reportId, action: 'created' as const }
  };

  const resolveReport = (report: unknown) => {
    vi.mocked(ReportAssetModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(report)
    } as never);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolveReport({
      _id: reportId,
      assetId,
      top_level_asset_id: topLevelAssetId,
      EquipmentHealth: '2',
      alarmId: 42,
      visible: true
    });
    vi.mocked(ReportAssetModel.countDocuments).mockResolvedValue(0);
    vi.mocked(processorAPIService.updateAssetHealthStatusOld).mockResolvedValue(undefined);
    vi.mocked(processorAPIService.updateAlarmHistoryData).mockResolvedValue(undefined);
    vi.mocked(processorAPIService.assetHealthFreezeStatus).mockResolvedValue(undefined);
  });

  it('synchronizes created report health and alarm with deterministic keys', async () => {
    await handleAssetReportProcessorSync(baseEnvelope);

    expect(ReportAssetModel.findOne).toHaveBeenCalledWith({
      _id: reportId,
      accountId: tenantId
    });
    expect(processorAPIService.updateAssetHealthStatusOld).toHaveBeenCalledWith(
      {
        asset_id: assetId,
        health_created_from: 'report',
        asset_status: 'Danger',
        org_id: tenantId
      },
      'processor-service-token',
      actorId,
      'report-event-1:health'
    );
    expect(processorAPIService.updateAlarmHistoryData).toHaveBeenCalledWith(
      { alarm_id: 42, report_id: reportId, action_type: 'created' },
      actorId,
      'processor-service-token',
      'report-event-1:alarm-created'
    );
  });

  it('unfreezes health only after the last incomplete report completes', async () => {
    await handleAssetReportProcessorSync({
      ...baseEnvelope,
      payload: { reportId, action: 'completed' }
    });

    expect(ReportAssetModel.countDocuments).toHaveBeenCalledWith({
      accountId: tenantId,
      top_level_asset_id: topLevelAssetId,
      status: { $ne: 'Completed' },
      visible: true
    });
    expect(processorAPIService.assetHealthFreezeStatus).toHaveBeenCalledWith(
      { asset_id: topLevelAssetId, freeze_score: false },
      actorId,
      'processor-service-token',
      'report-event-1:unfreeze'
    );
  });

  it('replays deletion from the tenant-owned soft-deleted report', async () => {
    resolveReport({
      _id: reportId,
      top_level_asset_id: topLevelAssetId,
      alarmId: 42,
      visible: false
    });

    await handleAssetReportProcessorSync({
      ...baseEnvelope,
      payload: { reportId, action: 'deleted' }
    });

    expect(processorAPIService.updateAlarmHistoryData).toHaveBeenCalledWith(
      { alarm_id: 42, report_id: reportId, action_type: 'delete' },
      actorId,
      'processor-service-token',
      'report-event-1:alarm-deleted'
    );
  });

  it('rejects a malformed action before loading report data', async () => {
    await expect(handleAssetReportProcessorSync({
      ...baseEnvelope,
      payload: { reportId, action: 'invalid' }
    } as any)).rejects.toThrow('malformed');
    expect(ReportAssetModel.findOne).not.toHaveBeenCalled();
  });

  it('registers the exact report processor event contract', () => {
    registerAssetReportProcessorHandlers();
    expect(registerDomainEventHandler).toHaveBeenCalledWith(
      'processor.asset-report.synchronize',
      1,
      handleAssetReportProcessorSync
    );
  });
});
