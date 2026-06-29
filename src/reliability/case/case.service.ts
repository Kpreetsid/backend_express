import { Types } from 'mongoose';
import { ObjectId } from 'mongodb';
import { get } from 'lodash';
import { AssetModel } from '../../models/asset.model';
import { LocationModel } from '../../models/location.model';
import {
  IReliabilityCaseAlarmRef,
  IReliabilityCaseDiagnosisSnapshot,
  IReliabilityCaseEvidenceSnapshot,
  RELIABILITY_CASE_RISK_LEVELS,
  RELIABILITY_CASE_STATUSES,
  ReliabilityCaseModel,
  ReliabilityCaseRiskLevel,
  ReliabilityCaseStatus
} from '../../models/reliabilityCase.model';
import { processorAPIService } from '../../api-processor';
import { applyRoleFilter } from '../../utils/roleFilter';
import {
  CreateCaseFromAlertsPayload,
  ProcessorAlarmEvidence,
  ProcessorDiagnosticReport,
  ProcessorHealthSnapshot,
  ProcessorReliabilityEvidenceResponse,
  ReliabilityCaseActor,
  UpdateCaseStatusPayload
} from './case.types';

const OPEN_CASE_STATUSES: ReliabilityCaseStatus[] = [
  'open',
  'triaged',
  'diagnosed',
  'recommendation_ready',
  'approval_pending',
  'approved',
  'work_order_created',
  'in_progress',
  'feedback_pending',
  'snoozed'
];

class ReliabilityCaseService {
  async getCases(user: ReliabilityCaseActor, query: Record<string, unknown>) {
    const baseFilter: Record<string, unknown> = {};
    const status = this.stringQuery(query.status);
    const riskLevel = this.stringQuery(query.risk_level);
    const assetId = this.stringQuery(query.asset_id);
    const search = this.stringQuery(query.search);

    if (status) {
      baseFilter.status = { $in: status.split(',').map((item) => item.trim()).filter(Boolean) };
    }

    if (riskLevel) {
      baseFilter.risk_level = { $in: riskLevel.split(',').map((item) => item.trim()).filter(Boolean) };
    }

    if (assetId) {
      baseFilter.asset_id = new Types.ObjectId(assetId);
    }

    if (search) {
      baseFilter.$or = [
        { case_no: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const filter = await applyRoleFilter({
      user: user as any,
      baseFilter,
      accountField: 'account_id',
      mapping: 'asset',
      idField: 'asset_id'
    });

    return await this.aggregateCases(filter);
  }

  async getCaseById(user: ReliabilityCaseActor, caseId: string) {
    const baseFilter = { _id: new Types.ObjectId(caseId) };
    const filter = await applyRoleFilter({
      user: user as any,
      baseFilter,
      accountField: 'account_id',
      mapping: 'asset',
      idField: 'asset_id'
    });
    const data = await this.aggregateCases(filter);
    if (!data.length) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }
    return data[0];
  }

  async createFromAlerts(payload: CreateCaseFromAlertsPayload, user: ReliabilityCaseActor, token: string) {
    const alarmIds = [...new Set((payload.alarm_ids || []).map((id) => String(id).trim()).filter(Boolean))];
    if (!alarmIds.length) {
      throw Object.assign(new Error('alarm_ids is required'), { status: 400 });
    }

    const existing = await ReliabilityCaseModel.findOne({
      account_id: user.account_id,
      visible: true,
      status: { $in: OPEN_CASE_STATUSES },
      'linked_alarms.alarm_id': { $in: alarmIds }
    }).lean();

    if (existing) {
      throw Object.assign(new Error(`Alarm is already linked to reliability case ${existing.case_no}`), { status: 409 });
    }

    const evidence = await processorAPIService.getReliabilityAlarmEvidence({ alarm_ids: alarmIds }, token, user._id);
    const normalizedEvidence = this.normalizeEvidenceResponse(evidence);
    const alarms = normalizedEvidence.alarms || [];

    if (!alarms.length) {
      throw Object.assign(new Error('No alarm history records found for selected alarms'), { status: 404 });
    }

    const primaryAlarm = alarms[0];
    const assetId = this.resolvePrimaryAssetId(alarms);
    const asset = await AssetModel.findOne({
      _id: new Types.ObjectId(assetId),
      account_id: user.account_id,
      visible: true
    }).lean();

    if (!asset) {
      throw Object.assign(new Error('Linked asset was not found in this account'), { status: 404 });
    }

    const locationId = asset.locationId;
    const riskLevel = this.riskFromPriority(primaryAlarm.priority);
    const timestamps = alarms.map((alarm) => this.toDate(alarm.timestamp || alarm.creation_date)).filter((value): value is Date => !!value);
    const linkedAlarms = this.buildLinkedAlarms(alarms, normalizedEvidence.diagnostic_reports || []);
    const evidenceSnapshot = this.buildEvidenceSnapshot(alarms, normalizedEvidence.asset_health || []);
    const diagnosisSnapshot = this.buildDiagnosisSnapshot(normalizedEvidence.diagnostic_reports || []);
    const title = payload.title?.trim() || this.buildCaseTitle(asset.asset_name, primaryAlarm);

    const newCase = new ReliabilityCaseModel({
      account_id: user.account_id,
      case_no: await this.generateCaseNo(user.account_id),
      title,
      description: payload.description,
      asset_id: asset._id,
      top_level_asset_id: asset.top_level_asset_id || asset._id,
      location_id: locationId,
      status: 'open',
      risk_level: riskLevel,
      urgency: this.urgencyFromRisk(riskLevel),
      detected_at: timestamps[0] || new Date(),
      first_alarm_at: timestamps.length ? new Date(Math.min(...timestamps.map((item) => item.getTime()))) : undefined,
      latest_alarm_at: timestamps.length ? new Date(Math.max(...timestamps.map((item) => item.getTime()))) : undefined,
      linked_alarms: linkedAlarms,
      evidence_snapshot: evidenceSnapshot,
      diagnosis_snapshot: diagnosisSnapshot,
      status_history: [{ status: 'open', createdBy: user._id, createdAt: new Date(), note: 'Created from alarm history.' }],
      audit_log: [this.auditEntry('created', user, { alarm_ids: alarmIds })],
      createdBy: user._id
    });

    await newCase.save();
    const enriched = await this.aggregateCases({ _id: newCase._id, account_id: user.account_id, visible: true });
    return enriched[0] || newCase;
  }

  async updateStatus(caseId: string, payload: UpdateCaseStatusPayload, user: ReliabilityCaseActor) {
    const statusValue = payload.status;
    if (!RELIABILITY_CASE_STATUSES.includes(statusValue)) {
      throw Object.assign(new Error('Invalid reliability case status'), { status: 400 });
    }

    const existing = await ReliabilityCaseModel.findOne({
      _id: new Types.ObjectId(caseId),
      account_id: user.account_id,
      visible: true
    });

    if (!existing) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }

    existing.status = statusValue;
    existing.updatedBy = user._id;
    existing.status_history.push({
      status: statusValue,
      createdBy: user._id,
      createdAt: new Date(),
      note: payload.note
    });
    existing.audit_log.push(this.auditEntry('status-changed', user, { status: statusValue, note: payload.note }));
    await existing.save();
    return await this.getCaseById(user, caseId);
  }

  async addNote(caseId: string, note: string, user: ReliabilityCaseActor) {
    if (!note?.trim()) {
      throw Object.assign(new Error('note is required'), { status: 400 });
    }
    const updated = await ReliabilityCaseModel.findOneAndUpdate(
      { _id: new Types.ObjectId(caseId), account_id: user.account_id, visible: true },
      {
        $set: { updatedBy: user._id },
        $push: { audit_log: this.auditEntry('note-added', user, { note }) }
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }
    return await this.getCaseById(user, caseId);
  }

  async linkWorkOrder(caseId: string, body: { work_order_id?: string; work_order_no?: string }, user: ReliabilityCaseActor) {
    if (!body.work_order_id) {
      throw Object.assign(new Error('work_order_id is required'), { status: 400 });
    }
    const updated = await ReliabilityCaseModel.findOneAndUpdate(
      { _id: new Types.ObjectId(caseId), account_id: user.account_id, visible: true },
      {
        $set: {
          linked_work_order_id: new Types.ObjectId(body.work_order_id),
          linked_work_order_no: body.work_order_no,
          status: 'work_order_created',
          updatedBy: user._id
        },
        $push: {
          status_history: { status: 'work_order_created', createdBy: user._id, createdAt: new Date(), note: 'Linked to work order.' },
          audit_log: this.auditEntry('work-order-linked', user, body)
        }
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }
    return await this.getCaseById(user, caseId);
  }

  private async aggregateCases(match: Record<string, unknown>) {
    return await ReliabilityCaseModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: AssetModel.collection.name,
          let: { assetId: '$asset_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$assetId'] }, visible: true } },
            { $project: { _id: 1, id: '$_id', asset_name: 1, asset_type: 1, asset_model: 1, top_level: 1, parent_id: 1, top_level_asset_id: 1, locationId: 1 } }
          ],
          as: 'asset'
        }
      },
      { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { locationId: '$location_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$locationId'] }, visible: true } },
            { $project: { _id: 1, id: '$_id', location_name: 1, location_type: 1, parent_id: 1 } }
          ],
          as: 'location'
        }
      },
      { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
      { $addFields: { id: '$_id', linked_alarm_count: { $size: { $ifNull: ['$linked_alarms', []] } } } },
      { $sort: { updatedAt: -1, createdAt: -1 } }
    ]);
  }

  private async generateCaseNo(accountId: ObjectId): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RC-${year}-`;
    const latestCase = await ReliabilityCaseModel.findOne({
      account_id: accountId,
      case_no: { $regex: `^${prefix}` }
    }).sort({ case_no: -1 }).select('case_no').lean();
    const latestNo = latestCase?.case_no ? Number(String(latestCase.case_no).replace(prefix, '')) : 0;
    const nextNo = Number.isFinite(latestNo) ? latestNo + 1 : 1;
    return `${prefix}${String(nextNo).padStart(6, '0')}`;
  }

  private normalizeEvidenceResponse(response: unknown): ProcessorReliabilityEvidenceResponse {
    const data = response as ProcessorReliabilityEvidenceResponse | { data?: ProcessorReliabilityEvidenceResponse };
    if ('data' in data && data.data) return data.data;
    return data as ProcessorReliabilityEvidenceResponse;
  }

  private resolvePrimaryAssetId(alarms: ProcessorAlarmEvidence[]): string {
    const assetId = alarms.find((alarm) => alarm.asset_id)?.asset_id;
    if (!assetId || !Types.ObjectId.isValid(assetId)) {
      throw Object.assign(new Error('Alarm does not contain a valid Express asset_id'), { status: 400 });
    }
    return assetId;
  }

  private buildLinkedAlarms(alarms: ProcessorAlarmEvidence[], reports: ProcessorDiagnosticReport[]): IReliabilityCaseAlarmRef[] {
    return alarms.map((alarm) => {
      const alarmId = String(alarm.id);
      const report = reports.find((item) => String(item.alarm_history || '') === alarmId);
      return {
        source: 'alarm_history',
        alarm_id: alarmId,
        asset_id: alarm.asset_id,
        composite: alarm.composite,
        signal_type: alarm.signal_type,
        trend_type: alarm.trend_type,
        axis: alarm.axis,
        priority: alarm.priority,
        sensor_location: alarm.sensor_location,
        threshold_value: this.toNumber(alarm.threshold_value),
        observed_value: this.toNumber(alarm.observed_value),
        timestamp: this.toDate(alarm.timestamp || alarm.creation_date),
        diagnostic_report_id: report?.id ? String(report.id) : undefined,
        report_created: alarm.report_created,
        report_id: alarm.report_id || undefined
      };
    });
  }

  private buildEvidenceSnapshot(alarms: ProcessorAlarmEvidence[], healthRows: ProcessorHealthSnapshot[]): IReliabilityCaseEvidenceSnapshot {
    const health = healthRows[0];
    const symptoms = [...new Set(alarms.map((alarm) => this.describeAlarmSymptom(alarm)).filter(Boolean))];
    return {
      health_status: health?.status,
      health_score: this.toNumber(health?.score),
      worst_kpi: health?.worst_kpi,
      symptoms,
      sensor_evidence: alarms.map((alarm) => ({
        composite: alarm.composite,
        endpoint_name: alarm.sensor_location,
        metric: [alarm.signal_type, alarm.trend_type].filter(Boolean).join(' / '),
        axis: alarm.axis,
        observed_value: this.toNumber(alarm.observed_value),
        threshold_value: this.toNumber(alarm.threshold_value),
        timestamp: alarm.timestamp
      })),
      chart_refs: alarms.map((alarm) => ({
        label: `${alarm.sensor_location || alarm.composite || 'Sensor'} evidence`,
        source: 'django',
        api: 'get_alarm_plot_data/',
        payload: {
          alarm_id: alarm.id,
          mac_id: alarm.composite,
          timestamp: alarm.timestamp,
          axis: alarm.axis,
          assetId: alarm.asset_id
        }
      }))
    };
  }

  private buildDiagnosisSnapshot(reports: ProcessorDiagnosticReport[]): IReliabilityCaseDiagnosisSnapshot | undefined {
    const sortedReports = [...reports].sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
      return rightTime - leftTime;
    });
    const report = sortedReports.find((item) => item.response_json || item.report_json);
    const responseJson = report?.response_json;
    const message = responseJson?.message || report?.report_json;
    if (!message) return undefined;
    return {
      diagnosis_source: 'django_rule',
      likely_failure_mode: this.firstText(message?.possible_faults?.[0]?.fault || message?.primary_fault?.fault_key || message?.primary_fault?.label),
      confidence: this.normalizeConfidence(message?.primary_fault?.confidence || message?.confidence),
      confidence_score: this.toNumber(message?.primary_fault?.score),
      summary: this.firstText(message?.overall_summary || message?.summary),
      observations: this.arrayOfStrings(message?.observations),
      recommendations: this.arrayOfStrings(message?.recommendations),
      severity_assessment: this.firstText(message?.severity_assessment),
      maintenance_priority: this.firstText(message?.maintenance_priority),
      fault_timeline: Array.isArray(message?.fault_timeline) ? message.fault_timeline : [],
      limitations: this.arrayOfStrings(message?.limitations)
    };
  }

  private riskFromPriority(priority?: string): ReliabilityCaseRiskLevel {
    const normalized = String(priority || '').toLowerCase();
    if (normalized === 'critical') return 'Urgent';
    if (normalized === 'danger') return 'High';
    if (normalized === 'alert') return 'Medium';
    if (RELIABILITY_CASE_RISK_LEVELS.includes(priority as ReliabilityCaseRiskLevel)) return priority as ReliabilityCaseRiskLevel;
    return 'Low';
  }

  private urgencyFromRisk(riskLevel: ReliabilityCaseRiskLevel) {
    if (riskLevel === 'Urgent') return 'immediate';
    if (riskLevel === 'High') return 'schedule';
    if (riskLevel === 'Medium') return 'plan';
    return 'monitor';
  }

  private buildCaseTitle(assetName: string, alarm: ProcessorAlarmEvidence): string {
    const priority = alarm.priority || 'Alarm';
    const symptom = [alarm.signal_type, alarm.trend_type].filter(Boolean).join(' / ') || 'condition';
    return `${assetName}: ${priority} ${symptom} anomaly`;
  }

  private describeAlarmSymptom(alarm: ProcessorAlarmEvidence): string {
    return [alarm.priority, alarm.signal_type, alarm.trend_type, alarm.axis]
      .filter(Boolean)
      .join(' ');
  }

  private auditEntry(action: string, user: ReliabilityCaseActor, metadata?: Record<string, unknown>) {
    const actorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || String(user._id);
    return {
      action,
      metadata,
      actor_id: user._id,
      actor_name: actorName,
      createdAt: new Date()
    };
  }

  private stringQuery(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return undefined;
  }

  private toNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private toDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private firstText(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      const label = get(value, 'label') || get(value, 'fault_key') || get(value, 'fault');
      return typeof label === 'string' ? label : undefined;
    }
    return undefined;
  }

  private arrayOfStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).filter(Boolean);
  }

  private normalizeConfidence(value: unknown): 'low' | 'medium' | 'high' | undefined {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'high' || normalized === 'medium' || normalized === 'low') return normalized;
    return undefined;
  }
}

export const reliabilityCaseService = new ReliabilityCaseService();
