import { Types } from 'mongoose';
import { processorAPIService } from '../../api-processor';
import { externalAPI } from '../../configDB';
import {
  ASSET_REPORT_STATUS,
  ReportAssetModel
} from '../../models/assetReport.model';
import { QueueEventEnvelope } from '../event-envelope';
import { registerDomainEventHandler } from '../domain-event-consumer';
import { AssetReportProcessorAction } from '../processor-events';

interface AssetReportProcessorPayload {
  reportId: string;
  action: AssetReportProcessorAction;
}

const healthStatusByCode: Record<string, string> = {
  '1': 'Critical',
  '2': 'Danger',
  '3': 'Alert',
  '4': 'Healthy',
  '5': 'Not Defined'
};
const actions = new Set<AssetReportProcessorAction>([
  'created',
  'updated',
  'completed',
  'deleted'
]);

const parsePayload = (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): AssetReportProcessorPayload => {
  const payload = envelope.payload as Partial<AssetReportProcessorPayload>;
  if (
    !payload?.reportId
    || !payload.action
    || !actions.has(payload.action)
    || envelope.entity.type !== 'asset-report'
    || envelope.entity.id !== payload.reportId
    || !envelope.actorId
    || !Types.ObjectId.isValid(payload.reportId)
    || !Types.ObjectId.isValid(envelope.tenantId)
    || !Types.ObjectId.isValid(envelope.actorId)
  ) {
    throw new Error('processor.asset-report.synchronize payload is malformed');
  }
  return payload as AssetReportProcessorPayload;
};

export const synchronizeAssetReportProcessor = async (
  reportId: string,
  action: AssetReportProcessorAction,
  tenantId: string,
  actorId: string,
  deliveryId: string
): Promise<void> => {
  if (!externalAPI.URL || !externalAPI.token) {
    throw new Error('Processor API URL and service token are required');
  }

  const report = await ReportAssetModel.findOne({
    _id: reportId,
    accountId: tenantId
  }).lean();
  if (!report) return;

  if (action === 'created' || action === 'updated') {
    const status = healthStatusByCode[String(report.EquipmentHealth)];
    if (report.assetId && status) {
      await processorAPIService.updateAssetHealthStatusOld({
        asset_id: report.assetId,
        health_created_from: 'report',
        asset_status: status,
        org_id: tenantId
      }, externalAPI.token, actorId, `${deliveryId}:health`);
    }
  }

  if (action === 'created' && report.alarmId) {
    await processorAPIService.updateAlarmHistoryData({
      alarm_id: report.alarmId,
      report_id: report._id,
      action_type: 'created'
    }, actorId, externalAPI.token, `${deliveryId}:alarm-created`);
  }

  if ((action === 'completed' || action === 'deleted') && report.top_level_asset_id) {
    const incompleteCount = await ReportAssetModel.countDocuments({
      accountId: tenantId,
      top_level_asset_id: report.top_level_asset_id,
      status: { $ne: ASSET_REPORT_STATUS[3]! },
      visible: true
    });
    if (incompleteCount === 0) {
      await processorAPIService.assetHealthFreezeStatus({
        asset_id: report.top_level_asset_id,
        freeze_score: false
      }, actorId, externalAPI.token, `${deliveryId}:unfreeze`);
    }
  }

  if (action === 'deleted' && report.alarmId) {
    await processorAPIService.updateAlarmHistoryData({
      alarm_id: report.alarmId,
      report_id: reportId,
      action_type: 'delete'
    }, actorId, externalAPI.token, `${deliveryId}:alarm-deleted`);
  }
};

export const handleAssetReportProcessorSync = async (
  envelope: QueueEventEnvelope<Record<string, unknown>>
): Promise<void> => {
  const payload = parsePayload(envelope);
  await synchronizeAssetReportProcessor(
    payload.reportId,
    payload.action,
    envelope.tenantId,
    envelope.actorId!,
    envelope.eventId
  );
};

export const registerAssetReportProcessorHandlers = (): void => {
  registerDomainEventHandler(
    'processor.asset-report.synchronize',
    1,
    handleAssetReportProcessorSync
  );
};
