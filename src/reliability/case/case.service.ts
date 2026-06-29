import { Types } from 'mongoose';
import { ObjectId } from 'mongodb';
import { get } from 'lodash';
import { AssetModel } from '../../models/asset.model';
import { ReportAssetModel } from '../../models/assetReport.model';
import { LocationModel } from '../../models/location.model';
import { PartsModel } from '../../models/part.model';
import {
  IReliabilityCaseAlarmRef,
  IReliabilityCaseAssetReportRef,
  IReliabilityCaseDiagnosisSnapshot,
  IReliabilityCaseEvidenceSnapshot,
  IReliabilityCaseRecommendationSnapshot,
  RELIABILITY_CASE_RISK_LEVELS,
  RELIABILITY_CASE_STATUSES,
  ReliabilityCaseModel,
  ReliabilityCaseRiskLevel,
  ReliabilityCaseStatus
} from '../../models/reliabilityCase.model';
import { processorAPIService } from '../../api-processor';
import { applyRoleFilter } from '../../utils/roleFilter';
import { notificationService } from '../../utils/notification.service';
import { orderService } from '../../work/order/order.service';
import {
  ApprovalPayload,
  CloseCasePayload,
  CreateCaseFromAssetReportPayload,
  CreateCaseFromAlertsPayload,
  FeedbackPayload,
  ProcessorAlarmEvidence,
  ProcessorDiagnosticReport,
  ProcessorHealthSnapshot,
  ProcessorReliabilityEvidenceResponse,
  RecommendationPayload,
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

const STATUS_TRANSITIONS: Record<ReliabilityCaseStatus, ReliabilityCaseStatus[]> = {
  open: ['triaged', 'rejected', 'snoozed'],
  triaged: ['diagnosed', 'rejected', 'snoozed'],
  diagnosed: ['recommendation_ready'],
  recommendation_ready: ['approval_pending', 'approved'],
  approval_pending: ['approved', 'rejected'],
  approved: ['work_order_created'],
  work_order_created: ['in_progress', 'feedback_pending'],
  in_progress: ['feedback_pending'],
  feedback_pending: ['closed'],
  closed: [],
  rejected: [],
  snoozed: ['open', 'triaged', 'rejected']
};

const RISK_RANK: Record<string, number> = {
  None: 0,
  Low: 1,
  Medium: 2,
  High: 3,
  Urgent: 4
};

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
      return await this.getCaseById(user, String(existing._id));
    }

    const evidence = await processorAPIService.getReliabilityAlarmEvidence({ alarm_ids: alarmIds }, token, user._id);
    const normalizedEvidence = this.normalizeEvidenceResponse(evidence);
    const alarms = normalizedEvidence.alarms || [];

    if (!alarms.length) {
      throw Object.assign(new Error('No alarm history records found for selected alarms'), { status: 404 });
    }
    if (alarms.some((alarm) => alarm.id === undefined || alarm.id === null || String(alarm.id).trim() === '')) {
      throw Object.assign(new Error('Reliability alarm evidence is missing alarm history ids'), { status: 502 });
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

    const windowHours = this.normalizeGroupingWindow(payload.grouping_window_hours);
    const groupedCase = await this.findGroupingCandidate(user, asset, alarms, normalizedEvidence.diagnostic_reports || [], windowHours);
    if (groupedCase) {
      return await this.attachAlertsToCase(String(groupedCase._id), alarmIds, alarms, normalizedEvidence, user);
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
    await this.notifyReliabilityCase(newCase, user, 'created', 'RELIABILITY_CASE_CREATED', `Reliability case ${newCase.case_no} was created.`);
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

    this.assertStatusTransition(existing.status, statusValue);
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
    await this.notifyReliabilityCaseStatus(existing, user);
    return await this.getCaseById(user, caseId);
  }

  async groupAlerts(payload: CreateCaseFromAlertsPayload, user: ReliabilityCaseActor, token: string) {
    return await this.createFromAlerts({
      ...payload,
      grouping_window_hours: this.normalizeGroupingWindow(payload.grouping_window_hours)
    }, user, token);
  }

  async createFromAssetReport(payload: CreateCaseFromAssetReportPayload, user: ReliabilityCaseActor) {
    const reportId = String(payload.asset_report_id || '').trim();
    if (!reportId || !Types.ObjectId.isValid(reportId)) {
      throw Object.assign(new Error('asset_report_id is required'), { status: 400 });
    }

    const report = await ReportAssetModel.findOne({
      _id: new Types.ObjectId(reportId),
      accountId: user.account_id,
      visible: true
    }).lean();

    if (!report) {
      throw Object.assign(new Error('Asset report not found'), { status: 404 });
    }

    const existing = await ReliabilityCaseModel.findOne({
      account_id: user.account_id,
      visible: true,
      status: { $in: OPEN_CASE_STATUSES },
      'linked_asset_reports.report_id': report._id
    }).lean();

    if (existing) {
      return await this.getCaseById(user, String(existing._id));
    }

    const assetId = report.assetId || report.top_level_asset_id;
    const asset = await AssetModel.findOne({
      _id: new Types.ObjectId(String(assetId)),
      account_id: user.account_id,
      visible: true
    }).lean();

    if (!asset) {
      throw Object.assign(new Error('Linked asset was not found in this account'), { status: 404 });
    }

    const riskLevel = this.riskFromAssetReport(report);
    const reportRef = this.buildAssetReportRef(report);
    const evidenceSnapshot = this.buildAssetReportEvidenceSnapshot(report);
    const diagnosisSnapshot = this.buildAssetReportDiagnosisSnapshot(report);
    const recommendationSnapshot = this.buildAssetReportRecommendationSnapshot(report, user);
    const title = payload.title?.trim() || this.buildAssetReportCaseTitle(asset.asset_name, report);

    const newCase = new ReliabilityCaseModel({
      account_id: user.account_id,
      case_no: await this.generateCaseNo(user.account_id),
      title,
      description: payload.description?.trim() || report.Observations || report.Recommendations,
      asset_id: asset._id,
      top_level_asset_id: report.top_level_asset_id || asset.top_level_asset_id || asset._id,
      location_id: report.locationId || asset.locationId,
      status: 'recommendation_ready',
      risk_level: riskLevel,
      urgency: this.urgencyFromRisk(riskLevel),
      detected_at: report.createdOn || new Date(),
      linked_alarms: [],
      linked_asset_reports: [reportRef],
      evidence_snapshot: evidenceSnapshot,
      diagnosis_snapshot: diagnosisSnapshot,
      recommendation_snapshot: recommendationSnapshot,
      linked_work_order_id: report.work_order_id || undefined,
      status_history: [
        { status: 'open', createdBy: user._id, createdAt: new Date(), note: 'Created from asset report.' },
        { status: 'recommendation_ready', createdBy: user._id, createdAt: new Date(), note: 'Asset report recommendation imported.' }
      ],
      audit_log: [this.auditEntry('created-from-asset-report', user, { asset_report_id: reportId })],
      createdBy: user._id
    });

    await newCase.save();
    await this.notifyReliabilityCase(newCase, user, 'created', 'RELIABILITY_CASE_CREATED', `Reliability case ${newCase.case_no} was created from an asset report.`);
    const enriched = await this.aggregateCases({ _id: newCase._id, account_id: user.account_id, visible: true });
    return enriched[0] || newCase;
  }

  async updateRecommendation(caseId: string, payload: RecommendationPayload, user: ReliabilityCaseActor) {
    const existing = await ReliabilityCaseModel.findOne({
      _id: new Types.ObjectId(caseId),
      account_id: user.account_id,
      visible: true
    });

    if (!existing) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }

    const recommendation = this.buildRecommendationSnapshot(existing.toObject(), payload, user);
    existing.recommendation_snapshot = recommendation;
    existing.updatedBy = user._id;
    if (existing.status === 'diagnosed' || existing.status === 'triaged' || existing.status === 'open') {
      existing.status = 'recommendation_ready';
      existing.status_history.push({
        status: 'recommendation_ready',
        createdBy: user._id,
        createdAt: new Date(),
        note: 'Recommendation prepared.'
      });
    }
    existing.audit_log.push(this.auditEntry('recommendation-updated', user, { generated_by: recommendation.generated_by }));
    await existing.save();
    await this.notifyReliabilityCase(existing, user, 'updated', 'RELIABILITY_CASE_RECOMMENDATION_READY', `Recommendation is ready for reliability case ${existing.case_no}.`);
    return await this.getCaseById(user, caseId);
  }

  async decideApproval(caseId: string, payload: ApprovalPayload, user: ReliabilityCaseActor) {
    const existing = await ReliabilityCaseModel.findOne({
      _id: new Types.ObjectId(caseId),
      account_id: user.account_id,
      visible: true
    });

    if (!existing) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }

    if (!existing.recommendation_snapshot) {
      throw Object.assign(new Error('Recommendation is required before approval.'), { status: 400 });
    }

    const nextStatus: ReliabilityCaseStatus = payload.decision === 'approved' ? 'approved' : 'rejected';
    existing.approval = {
      status: payload.decision,
      note: payload.note,
      requestedBy: existing.approval?.requestedBy || existing.createdBy,
      requestedAt: existing.approval?.requestedAt || new Date(),
      decidedBy: user._id,
      decidedAt: new Date()
    };
    existing.status = nextStatus;
    existing.updatedBy = user._id;
    existing.status_history.push({
      status: nextStatus,
      createdBy: user._id,
      createdAt: new Date(),
      note: payload.note || `Recommendation ${payload.decision}.`
    });
    existing.audit_log.push(this.auditEntry(`recommendation-${payload.decision}`, user, { note: payload.note }));
    await existing.save();
    await this.notifyReliabilityCase(existing, user, 'updated', payload.decision === 'approved' ? 'RELIABILITY_CASE_APPROVED' : 'RELIABILITY_CASE_REJECTED', `Reliability case ${existing.case_no} was ${payload.decision}.`);
    return await this.getCaseById(user, caseId);
  }

  async buildWorkOrderDraft(caseId: string, user: ReliabilityCaseActor, overrides: Record<string, unknown> = {}) {
    const caseData = await this.getCaseById(user, caseId);
    return await this.buildWorkOrderPayload(caseData, user, overrides);
  }

  async createWorkOrderFromCase(caseId: string, user: ReliabilityCaseActor, overrides: Record<string, unknown> = {}) {
    const caseData = await this.getCaseById(user, caseId);
    if (caseData.linked_work_order_id) {
      throw Object.assign(new Error('Reliability case is already linked to a work order.'), { status: 409 });
    }
    if (this.requiresApproval(caseData) && caseData.status !== 'approved') {
      throw Object.assign(new Error('High-risk reliability cases require approval before work-order creation.'), { status: 400 });
    }

    const draft = await this.buildWorkOrderPayload(caseData, user, overrides);
    const workOrder = await orderService.createWorkOrder(draft, user as any);
    const workOrderId = String(workOrder?._id || workOrder?.id || '');
    if (!workOrderId) {
      throw Object.assign(new Error('Work order was created but no id was returned.'), { status: 500 });
    }
    await this.linkWorkOrder(caseId, {
      work_order_id: workOrderId,
      work_order_no: workOrder?.order_no
    }, user);
    return {
      case: await this.getCaseById(user, caseId),
      work_order: workOrder
    };
  }

  async getSpareAvailability(caseId: string, user: ReliabilityCaseActor) {
    const caseData = await this.getCaseById(user, caseId);
    return await this.resolveSpareAvailability(caseData, user);
  }

  async addFeedback(caseId: string, payload: FeedbackPayload, user: ReliabilityCaseActor) {
    const existing = await ReliabilityCaseModel.findOne({
      _id: new Types.ObjectId(caseId),
      account_id: user.account_id,
      visible: true
    });

    if (!existing) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }

    if (!payload.work_performed?.trim()) {
      throw Object.assign(new Error('work_performed is required'), { status: 400 });
    }

    existing.technician_feedback = {
      work_performed: payload.work_performed.trim(),
      actual_failure_mode: payload.actual_failure_mode?.trim(),
      root_cause: payload.root_cause?.trim(),
      parts_used: Array.isArray(payload.parts_used) ? payload.parts_used : [],
      downtime_hours: this.toNumber(payload.downtime_hours),
      effectiveness: payload.effectiveness,
      follow_up_required: Boolean(payload.follow_up_required),
      follow_up_notes: payload.follow_up_notes?.trim(),
      submittedBy: user._id,
      submittedAt: new Date()
    };
    existing.status = 'feedback_pending';
    existing.updatedBy = user._id;
    existing.status_history.push({
      status: 'feedback_pending',
      createdBy: user._id,
      createdAt: new Date(),
      note: 'Technician feedback submitted.'
    });
    existing.audit_log.push(this.auditEntry('feedback-added', user, {
      effectiveness: payload.effectiveness,
      follow_up_required: Boolean(payload.follow_up_required)
    }));
    await existing.save();
    await this.notifyReliabilityCase(existing, user, 'updated', 'RELIABILITY_CASE_FEEDBACK_ADDED', `Feedback was added to reliability case ${existing.case_no}.`);
    return await this.getCaseById(user, caseId);
  }

  async closeCase(caseId: string, payload: CloseCasePayload, user: ReliabilityCaseActor) {
    const existing = await ReliabilityCaseModel.findOne({
      _id: new Types.ObjectId(caseId),
      account_id: user.account_id,
      visible: true
    });

    if (!existing) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }

    if (!payload.resolution_summary?.trim()) {
      throw Object.assign(new Error('resolution_summary is required'), { status: 400 });
    }

    if (!existing.technician_feedback) {
      throw Object.assign(new Error('Technician feedback is required before closing the case.'), { status: 400 });
    }

    existing.closure = {
      resolution_summary: payload.resolution_summary.trim(),
      final_failure_mode: payload.final_failure_mode?.trim() || existing.technician_feedback.actual_failure_mode,
      final_root_cause: payload.final_root_cause?.trim() || existing.technician_feedback.root_cause,
      lessons_learned: this.nonEmptyStrings(payload.lessons_learned),
      preventive_actions: this.nonEmptyStrings(payload.preventive_actions),
      closedBy: user._id,
      closedAt: new Date()
    };
    existing.status = 'closed';
    existing.updatedBy = user._id;
    existing.status_history.push({
      status: 'closed',
      createdBy: user._id,
      createdAt: new Date(),
      note: payload.resolution_summary.trim()
    });
    existing.audit_log.push(this.auditEntry('case-closed', user, {
      final_failure_mode: existing.closure.final_failure_mode,
      final_root_cause: existing.closure.final_root_cause
    }));
    await existing.save();
    await this.notifyReliabilityCase(existing, user, 'updated', 'RELIABILITY_CASE_CLOSED', `Reliability case ${existing.case_no} was closed.`);
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
    await this.notifyReliabilityCase(updated, user, 'updated', 'RELIABILITY_CASE_WORK_ORDER_LINKED', `Reliability case ${updated.case_no} was linked to a work order.`);
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

  private async attachAlertsToCase(caseId: string, alarmIds: string[], alarms: ProcessorAlarmEvidence[], evidence: ProcessorReliabilityEvidenceResponse, user: ReliabilityCaseActor) {
    const existing = await ReliabilityCaseModel.findOne({
      _id: new Types.ObjectId(caseId),
      account_id: user.account_id,
      visible: true
    });

    if (!existing) {
      throw Object.assign(new Error('Reliability case not found'), { status: 404 });
    }

    const existingAlarmIds = new Set((existing.linked_alarms || []).map((alarm) => String(alarm.alarm_id)));
    const newAlarms = alarms.filter((alarm) => !existingAlarmIds.has(String(alarm.id)));
    if (!newAlarms.length) {
      return await this.getCaseById(user, caseId);
    }

    const linkedAlarms = this.buildLinkedAlarms(newAlarms, evidence.diagnostic_reports || []);
    const evidenceSnapshot = this.buildEvidenceSnapshot(newAlarms, evidence.asset_health || []);
    const diagnosisSnapshot = this.buildDiagnosisSnapshot(evidence.diagnostic_reports || []);
    const timestamps = newAlarms.map((alarm) => this.toDate(alarm.timestamp || alarm.creation_date)).filter((value): value is Date => !!value);
    const riskLevel = this.maxRisk(existing.risk_level, this.riskFromPriority(newAlarms[0]?.priority));

    existing.linked_alarms.push(...linkedAlarms);
    existing.evidence_snapshot = this.mergeEvidenceSnapshots(existing.evidence_snapshot, evidenceSnapshot);
    existing.diagnosis_snapshot = diagnosisSnapshot || existing.diagnosis_snapshot;
    existing.risk_level = riskLevel;
    existing.urgency = this.urgencyFromRisk(riskLevel);
    existing.first_alarm_at = this.minDate(existing.first_alarm_at, timestamps.length ? new Date(Math.min(...timestamps.map((item) => item.getTime()))) : undefined);
    existing.latest_alarm_at = this.maxDate(existing.latest_alarm_at, timestamps.length ? new Date(Math.max(...timestamps.map((item) => item.getTime()))) : undefined);
    existing.updatedBy = user._id;
    existing.audit_log.push(this.auditEntry('alarms-grouped', user, { alarm_ids: alarmIds }));
    await existing.save();
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

  private async findGroupingCandidate(user: ReliabilityCaseActor, asset: any, alarms: ProcessorAlarmEvidence[], reports: ProcessorDiagnosticReport[], windowHours: number) {
    const latestAlarmDate = alarms
      .map((alarm) => this.toDate(alarm.timestamp || alarm.creation_date))
      .filter((value): value is Date => !!value)
      .sort((left, right) => right.getTime() - left.getTime())[0] || new Date();
    const windowStart = new Date(latestAlarmDate.getTime() - (windowHours * 60 * 60 * 1000));
    const faultFamily = this.getFaultFamily(alarms[0], reports[0]);
    const subtreeIds = [asset._id, asset.top_level_asset_id, asset.parent_id, asset.top_level ? asset._id : undefined]
      .filter(Boolean)
      .map((value) => new Types.ObjectId(String(value)));

    const candidates = await ReliabilityCaseModel.find({
      account_id: user.account_id,
      visible: true,
      status: { $in: OPEN_CASE_STATUSES },
      $or: [
        { asset_id: { $in: subtreeIds } },
        { top_level_asset_id: { $in: subtreeIds } }
      ],
      latest_alarm_at: { $gte: windowStart }
    }).sort({ latest_alarm_at: -1, updatedAt: -1 }).lean();

    return candidates.find((item: any) => this.caseFaultFamily(item) === faultFamily) || candidates[0] || null;
  }

  private normalizeGroupingWindow(value?: number): number {
    const numberValue = Number(value || 24);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return 24;
    return Math.min(numberValue, 168);
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

  private buildAssetReportRef(report: any): IReliabilityCaseAssetReportRef {
    return {
      report_id: report._id,
      asset_id: report.assetId,
      top_level_asset_id: report.top_level_asset_id,
      status: report.status,
      fault_detected: report.FaultDetected,
      severity: report.Severity,
      equipment_health: this.assetReportHealthLabel(report.EquipmentHealth),
      observations: report.Observations,
      recommendations: report.Recommendations,
      createdFrom: report.createdFrom,
      createdOn: report.createdOn
    };
  }

  private buildAssetReportEvidenceSnapshot(report: any): IReliabilityCaseEvidenceSnapshot {
    const endpointEvidence = (Array.isArray(report.endpointRMSData) ? report.endpointRMSData : []).map((point: any) => ({
      composite: point.composite_id,
      endpoint_name: point.point_name,
      mount_location: point.mount_location,
      mount_direction: point.mount_direction,
      asset_name: point.asset_name,
      acceleration: point.acceleration,
      velocity: point.velocity
    }));

    return {
      health_status: this.assetReportHealthLabel(report.EquipmentHealth),
      symptoms: this.nonEmptyStrings([
        report.FaultDetected,
        report.Severity,
        report.TrendOfAlarm
      ]),
      sensor_evidence: endpointEvidence,
      chart_refs: [{
        label: 'Asset report evidence',
        source: 'express',
        api: '/api/reports/assets/generate-pdf/:id',
        payload: { asset_report_id: String(report._id) }
      }]
    };
  }

  private buildAssetReportDiagnosisSnapshot(report: any): IReliabilityCaseDiagnosisSnapshot {
    return {
      diagnosis_source: 'human',
      likely_failure_mode: this.firstText(report.FaultDetected || report.NewFault),
      summary: this.firstText(report.Observations || report.Recommendations),
      observations: this.textLines(report.Observations),
      recommendations: this.textLines(report.Recommendations),
      severity_assessment: this.firstText(report.Severity),
      maintenance_priority: this.assetReportHealthLabel(report.EquipmentHealth)
    };
  }

  private buildAssetReportRecommendationSnapshot(report: any, user: ReliabilityCaseActor): IReliabilityCaseRecommendationSnapshot {
    const actions = this.textLines(report.Recommendations);
    return {
      action_summary: actions[0] || report.Recommendations || `Review asset report ${String(report._id)} and plan corrective action.`,
      inspection_steps: [
        'Review asset report observations, RMS readings, and chart evidence.',
        'Confirm fault condition at the asset before execution.'
      ],
      maintenance_actions: actions.length ? actions : ['Plan corrective maintenance from the asset report recommendation.'],
      safety_checklist: [
        'Confirm lockout/tagout requirements before work.',
        'Verify asset is safe to inspect and operate.',
        'Capture post-maintenance evidence after execution.'
      ],
      suggested_spares: [],
      suggested_tools: [],
      suggested_procedure_ids: [],
      suggested_assignee_ids: [],
      estimated_downtime_hours: this.estimatedDowntime(this.riskFromAssetReport(report)),
      business_impact: {
        source: 'asset_report',
        asset_report_id: String(report._id),
        report_status: report.status,
        equipment_health: this.assetReportHealthLabel(report.EquipmentHealth)
      },
      explanation: 'Imported from asset report observations, recommendations, health status, and reported fault details.',
      generated_by: 'human',
      generatedAt: new Date(),
      generatedBy: user._id
    };
  }

  private buildRecommendationSnapshot(caseData: any, payload: RecommendationPayload, user: ReliabilityCaseActor): IReliabilityCaseRecommendationSnapshot {
    const diagnosis = caseData.diagnosis_snapshot || {};
    const evidence = caseData.evidence_snapshot || {};
    const maintenanceActions = this.nonEmptyStrings(payload.maintenance_actions).length
      ? this.nonEmptyStrings(payload.maintenance_actions)
      : this.nonEmptyStrings(diagnosis.recommendations);
    const inspectionSteps = this.nonEmptyStrings(payload.inspection_steps).length
      ? this.nonEmptyStrings(payload.inspection_steps)
      : this.buildDefaultInspectionSteps(evidence.symptoms || [], diagnosis.observations || []);
    const actionSummary = payload.action_summary?.trim()
      || maintenanceActions[0]
      || diagnosis.summary
      || `Inspect ${caseData.asset?.asset_name || 'asset'} and correct reliability risk.`;

    return {
      action_summary: actionSummary,
      inspection_steps: inspectionSteps,
      maintenance_actions: maintenanceActions.length ? maintenanceActions : ['Inspect asset condition and complete corrective maintenance.'],
      safety_checklist: this.nonEmptyStrings(payload.safety_checklist).length ? this.nonEmptyStrings(payload.safety_checklist) : [
        'Confirm lockout/tagout requirements before work.',
        'Verify asset is safe to inspect and operate.',
        'Record pre-maintenance condition evidence.'
      ],
      suggested_spares: Array.isArray(payload.suggested_spares) ? payload.suggested_spares : [],
      suggested_tools: this.nonEmptyStrings(payload.suggested_tools),
      suggested_procedure_ids: this.objectIdStrings(payload.suggested_procedure_ids).map((id) => new Types.ObjectId(id) as any),
      suggested_assignee_ids: this.objectIdStrings(payload.suggested_assignee_ids).map((id) => new Types.ObjectId(id) as any),
      estimated_downtime_hours: this.toNumber(payload.estimated_downtime_hours) || this.estimatedDowntime(caseData.risk_level),
      business_impact: payload.business_impact,
      explanation: payload.explanation?.trim() || 'Generated from linked alarm evidence, health snapshot, and diagnostic recommendations.',
      generated_by: payload.generated_by || 'rule',
      generatedAt: new Date(),
      generatedBy: user._id
    };
  }

  private async buildWorkOrderPayload(caseData: any, user: ReliabilityCaseActor, overrides: Record<string, unknown> = {}) {
    const recommendation = caseData.recommendation_snapshot || {};
    const now = new Date();
    const estimatedHours = this.toNumber((overrides as any).estimated_time) || this.toNumber(recommendation.estimated_downtime_hours) || this.estimatedDowntime(caseData.risk_level);
    const endDate = new Date(now.getTime() + estimatedHours * 60 * 60 * 1000);
    const hasPartsOverride = Object.prototype.hasOwnProperty.call(overrides || {}, 'parts');
    const suggestedParts = hasPartsOverride ? [] : await this.buildAvailableWorkOrderPartsFromSpares(caseData, user);
    const tasks = [
      ...this.nonEmptyStrings(recommendation.inspection_steps).map((step) => ({ title: step, priority: caseData.risk_level || 'Medium' })),
      ...this.nonEmptyStrings(recommendation.maintenance_actions).map((action) => ({ title: action, priority: caseData.risk_level || 'Medium' }))
    ];

    return {
      title: `Reliability: ${caseData.title || caseData.case_no}`,
      description: [
        `Reliability case: ${caseData.case_no}`,
        recommendation.action_summary || caseData.diagnosis_snapshot?.summary || caseData.description || '',
        recommendation.explanation || ''
      ].filter(Boolean).join('\n\n'),
      priority: caseData.risk_level || 'Medium',
      status: 'Open',
      type: 'Corrective',
      nature_of_work: 'Corrective',
      createdFrom: 'Work Order',
      wo_asset_id: caseData.asset_id,
      wo_location_id: caseData.location_id,
      start_date: now,
      end_date: endDate,
      estimated_time: estimatedHours,
      tasks,
      procedure_ids: recommendation.suggested_procedure_ids || [],
      userIdList: recommendation.suggested_assignee_ids || [],
      parts: suggestedParts,
      labor_entries: [],
      ...overrides
    };
  }

  private async resolveSpareAvailability(caseData: any, user: ReliabilityCaseActor) {
    const suggestedSpares = Array.isArray(caseData?.recommendation_snapshot?.suggested_spares)
      ? caseData.recommendation_snapshot.suggested_spares
      : [];

    if (!suggestedSpares.length) {
      return {
        case_id: String(caseData?._id || caseData?.id || ''),
        case_no: caseData?.case_no,
        summary: { total: 0, available: 0, low_stock: 0, short: 0, out_of_stock: 0, unmatched: 0 },
        spares: []
      };
    }

    const lookupClauses = this.buildSpareLookupClauses(suggestedSpares);
    const parts = lookupClauses.length
      ? await PartsModel.find({
        account_id: user.account_id,
        visible: true,
        $or: lookupClauses
      }).lean()
      : [];

    const locationIds = Array.from(new Set(parts.map((part: any) => String(part.location_id || '')).filter(Boolean)));
    const locations = locationIds.length
      ? await LocationModel.find({ _id: { $in: locationIds.map((id) => new Types.ObjectId(id)) }, visible: true }, { location_name: 1 }).lean()
      : [];
    const locationMap = new Map(locations.map((location: any) => [String(location._id), location.location_name]));

    const rows = suggestedSpares.map((spare: any) => {
      const requestedQuantity = this.positiveNumber(spare?.quantity ?? spare?.estimatedQuantity ?? spare?.qty) || 1;
      const matchedPart = this.matchSuggestedSpare(spare, parts, caseData);
      if (!matchedPart) {
        return {
          requested: this.describeSuggestedSpare(spare),
          requested_quantity: requestedQuantity,
          status: 'unmatched',
          available_quantity: 0,
          projected_quantity_after_issue: null,
          shortage_quantity: requestedQuantity,
          reorder_recommended: false,
          lead_time_days: null,
          part: null,
          alternate_locations: []
        };
      }

      const availableQuantity = Number(matchedPart.quantity || 0);
      const projectedQuantity = availableQuantity - requestedQuantity;
      const reorderPoint = Number(matchedPart.reorder_point ?? matchedPart.min_quantity ?? 0) || 0;
      const shortageQuantity = Math.max(requestedQuantity - availableQuantity, 0);
      const status = this.spareAvailabilityStatus(availableQuantity, requestedQuantity, reorderPoint);
      const alternates = this.findAlternateSpareLocations(matchedPart, parts, requestedQuantity, locationMap);

      return {
        requested: this.describeSuggestedSpare(spare),
        requested_quantity: requestedQuantity,
        status,
        available_quantity: availableQuantity,
        projected_quantity_after_issue: projectedQuantity,
        shortage_quantity: shortageQuantity,
        reorder_recommended: shortageQuantity > 0 || projectedQuantity <= reorderPoint,
        lead_time_days: this.toNumber(matchedPart.lead_time_days),
        part: {
          id: String(matchedPart._id),
          part_name: matchedPart.part_name,
          part_number: matchedPart.part_number,
          unit: matchedPart.unit,
          cost: matchedPart.cost,
          currency: matchedPart.currency,
          location_id: matchedPart.location_id ? String(matchedPart.location_id) : null,
          location_name: matchedPart.location_id ? locationMap.get(String(matchedPart.location_id)) || null : null,
          min_quantity: matchedPart.min_quantity,
          reorder_point: matchedPart.reorder_point
        },
        alternate_locations: alternates
      };
    });

    const summary = rows.reduce((acc: Record<string, number>, row: any) => {
      acc.total += 1;
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, { total: 0, available: 0, low_stock: 0, short: 0, out_of_stock: 0, unmatched: 0 });

    return {
      case_id: String(caseData?._id || caseData?.id || ''),
      case_no: caseData?.case_no,
      summary,
      spares: rows
    };
  }

  private async buildAvailableWorkOrderPartsFromSpares(caseData: any, user: ReliabilityCaseActor): Promise<any[]> {
    const availability = await this.resolveSpareAvailability(caseData, user);
    return (availability.spares || [])
      .filter((row: any) => row.part?.id && ['available', 'low_stock'].includes(row.status))
      .map((row: any) => ({
        part_id: new Types.ObjectId(row.part.id),
        part_name: row.part.part_name,
        part_type: 'N/A',
        location_id: row.part.location_id ? new Types.ObjectId(row.part.location_id) : null,
        location_name: row.part.location_name || '',
        part_source: 'manual',
        estimatedQuantity: row.requested_quantity,
        actualQuantity: 0,
        unit: row.part.unit || '',
        cost: Number(row.part.cost || 0),
        currency: row.part.currency || 'INR'
      }));
  }

  private buildSpareLookupClauses(suggestedSpares: any[]): Record<string, unknown>[] {
    const clauses: Record<string, unknown>[] = [];
    suggestedSpares.forEach((spare: any) => {
      const id = String(spare?.part_id || spare?.id || spare?._id || '').trim();
      const partNumber = String(spare?.part_number || spare?.partNo || spare?.sku || '').trim();
      const partName = String(spare?.part_name || spare?.name || spare?.description || '').trim();

      if (id && Types.ObjectId.isValid(id)) {
        clauses.push({ _id: new Types.ObjectId(id) });
      }
      if (partNumber) {
        clauses.push({ part_number: { $regex: `^${this.escapeRegex(partNumber)}$`, $options: 'i' } });
      }
      if (partName) {
        clauses.push({ part_name: { $regex: `^${this.escapeRegex(partName)}$`, $options: 'i' } });
      }
    });
    return clauses;
  }

  private matchSuggestedSpare(spare: any, parts: any[], caseData: any): any | null {
    const id = String(spare?.part_id || spare?.id || spare?._id || '').trim();
    const partNumber = String(spare?.part_number || spare?.partNo || spare?.sku || '').trim().toLowerCase();
    const partName = String(spare?.part_name || spare?.name || spare?.description || '').trim().toLowerCase();

    let candidates = parts.filter((part: any) => id && String(part._id) === id);
    if (!candidates.length && partNumber) {
      candidates = parts.filter((part: any) => String(part.part_number || '').trim().toLowerCase() === partNumber);
    }
    if (!candidates.length && partName) {
      candidates = parts.filter((part: any) => String(part.part_name || '').trim().toLowerCase() === partName);
    }

    if (!candidates.length) return null;
    const caseLocationId = String(caseData?.location_id || caseData?.location?.id || caseData?.location?._id || '');
    return [...candidates].sort((left: any, right: any) => {
      const leftLocationMatch = String(left.location_id || '') === caseLocationId ? 1 : 0;
      const rightLocationMatch = String(right.location_id || '') === caseLocationId ? 1 : 0;
      if (leftLocationMatch !== rightLocationMatch) return rightLocationMatch - leftLocationMatch;
      return Number(right.quantity || 0) - Number(left.quantity || 0);
    })[0];
  }

  private findAlternateSpareLocations(part: any, parts: any[], requestedQuantity: number, locationMap: Map<string, string>): any[] {
    const partNumber = String(part.part_number || '').trim().toLowerCase();
    return parts
      .filter((candidate: any) => {
        if (String(candidate._id) === String(part._id)) return false;
        if (partNumber) return String(candidate.part_number || '').trim().toLowerCase() === partNumber;
        return String(candidate.part_name || '').trim().toLowerCase() === String(part.part_name || '').trim().toLowerCase();
      })
      .map((candidate: any) => ({
        part_id: String(candidate._id),
        location_id: candidate.location_id ? String(candidate.location_id) : null,
        location_name: candidate.location_id ? locationMap.get(String(candidate.location_id)) || null : null,
        available_quantity: Number(candidate.quantity || 0),
        can_cover_request: Number(candidate.quantity || 0) >= requestedQuantity
      }));
  }

  private spareAvailabilityStatus(availableQuantity: number, requestedQuantity: number, reorderPoint: number): string {
    if (availableQuantity <= 0) return 'out_of_stock';
    if (availableQuantity < requestedQuantity) return 'short';
    if ((availableQuantity - requestedQuantity) <= reorderPoint) return 'low_stock';
    return 'available';
  }

  private describeSuggestedSpare(spare: any): string {
    return String(spare?.part_name || spare?.name || spare?.part_number || spare?.sku || spare?.description || 'Suggested spare').trim();
  }

  private positiveNumber(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private assertStatusTransition(currentStatus: ReliabilityCaseStatus, nextStatus: ReliabilityCaseStatus): void {
    if (currentStatus === nextStatus) return;
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw Object.assign(new Error(`Invalid reliability case transition from ${currentStatus} to ${nextStatus}`), { status: 400 });
    }
  }

  private riskFromPriority(priority?: string): ReliabilityCaseRiskLevel {
    const normalized = String(priority || '').toLowerCase();
    if (normalized === 'critical') return 'Urgent';
    if (normalized === 'danger') return 'High';
    if (normalized === 'alert') return 'Medium';
    if (RELIABILITY_CASE_RISK_LEVELS.includes(priority as ReliabilityCaseRiskLevel)) return priority as ReliabilityCaseRiskLevel;
    return 'Low';
  }

  private riskFromAssetReport(report: any): ReliabilityCaseRiskLevel {
    const health = String(report?.EquipmentHealth || '').trim();
    const severity = String(report?.Severity || report?.FaultDetected || '').toLowerCase();
    if (health === '1' || /critical|severe|unacceptable/.test(severity)) return 'Urgent';
    if (health === '2' || /danger|high/.test(severity)) return 'High';
    if (health === '3' || /alert|medium|warning/.test(severity)) return 'Medium';
    if (health === '4') return 'Low';
    return 'Low';
  }

  private assetReportHealthLabel(value: unknown): string {
    const normalized = String(value || '').trim();
    const labels: Record<string, string> = {
      '1': 'Critical',
      '2': 'Danger',
      '3': 'Alert',
      '4': 'Healthy',
      '5': 'Not Defined'
    };
    return labels[normalized] || normalized || 'Not Defined';
  }

  private buildAssetReportCaseTitle(assetName: string, report: any): string {
    const fault = this.firstText(report?.FaultDetected || report?.NewFault);
    if (fault) {
      return `${assetName || report?.assetName || 'Asset'} reliability review: ${fault}`;
    }
    return `${assetName || report?.assetName || 'Asset'} reliability review from asset report`;
  }

  private urgencyFromRisk(riskLevel: ReliabilityCaseRiskLevel) {
    if (riskLevel === 'Urgent') return 'immediate';
    if (riskLevel === 'High') return 'schedule';
    if (riskLevel === 'Medium') return 'plan';
    return 'monitor';
  }

  private requiresApproval(caseData: any): boolean {
    return ['High', 'Urgent'].includes(String(caseData?.risk_level || ''));
  }

  private maxRisk(left: ReliabilityCaseRiskLevel, right: ReliabilityCaseRiskLevel): ReliabilityCaseRiskLevel {
    return (RISK_RANK[right] > RISK_RANK[left] ? right : left) as ReliabilityCaseRiskLevel;
  }

  private mergeEvidenceSnapshots(existing: IReliabilityCaseEvidenceSnapshot, incoming: IReliabilityCaseEvidenceSnapshot): IReliabilityCaseEvidenceSnapshot {
    return {
      health_status: incoming.health_status || existing.health_status,
      health_score: incoming.health_score ?? existing.health_score,
      worst_kpi: incoming.worst_kpi || existing.worst_kpi,
      symptoms: [...new Set([...(existing.symptoms || []), ...(incoming.symptoms || [])])],
      sensor_evidence: [...(existing.sensor_evidence || []), ...(incoming.sensor_evidence || [])],
      chart_refs: [...(existing.chart_refs || []), ...(incoming.chart_refs || [])]
    };
  }

  private minDate(left?: Date, right?: Date): Date | undefined {
    if (!left) return right;
    if (!right) return left;
    return new Date(Math.min(new Date(left).getTime(), new Date(right).getTime()));
  }

  private maxDate(left?: Date, right?: Date): Date | undefined {
    if (!left) return right;
    if (!right) return left;
    return new Date(Math.max(new Date(left).getTime(), new Date(right).getTime()));
  }

  private getFaultFamily(alarm?: ProcessorAlarmEvidence, report?: ProcessorDiagnosticReport): string {
    const diagnosis = report?.response_json?.message || report?.report_json || {};
    const fault = this.firstText(diagnosis?.primary_fault?.fault_key || diagnosis?.primary_fault?.label || diagnosis?.possible_faults?.[0]?.fault);
    if (fault) return this.normalizeFamily(fault);
    const signal = [alarm?.signal_type, alarm?.trend_type].filter(Boolean).join(' ');
    return this.normalizeFamily(signal);
  }

  private caseFaultFamily(caseData: any): string {
    return this.normalizeFamily(caseData?.diagnosis_snapshot?.likely_failure_mode || caseData?.evidence_snapshot?.symptoms?.[0] || caseData?.linked_alarms?.[0]?.signal_type || '');
  }

  private normalizeFamily(value: unknown): string {
    const text = String(value || '').toLowerCase();
    if (/(current|mcsa|voltage|electrical)/.test(text)) return 'electrical';
    if (/(temp|thermal|heat)/.test(text)) return 'thermal';
    if (/(bearing|velocity|acceleration|vibration|spectrum|envelope|rms|harmonic)/.test(text)) return 'mechanical';
    return text.trim() || 'general';
  }

  private buildDefaultInspectionSteps(symptoms: string[], observations: string[]): string[] {
    const source = [...symptoms, ...observations].slice(0, 4);
    if (!source.length) {
      return ['Review linked alarm trend evidence.', 'Inspect asset condition at the flagged sensor location.'];
    }
    return source.map((item) => `Verify ${String(item).toLowerCase()} condition on the asset.`);
  }

  private estimatedDowntime(riskLevel?: string): number {
    if (riskLevel === 'Urgent') return 8;
    if (riskLevel === 'High') return 4;
    if (riskLevel === 'Medium') return 2;
    return 1;
  }

  private nonEmptyStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  private textLines(value: unknown): string[] {
    if (Array.isArray(value)) return this.nonEmptyStrings(value);
    return String(value || '')
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private objectIdStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter((item) => Types.ObjectId.isValid(item));
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

  private async notifyReliabilityCase(caseData: any, user: ReliabilityCaseActor, event: 'created' | 'updated', type: string, message: string): Promise<void> {
    try {
      const id = String(caseData?._id || caseData?.id || '');
      if (!id) return;
      await notificationService.notifyAccountUsers({
        accountId: String(user.account_id),
        module: 'Reliability Case',
        event,
        entityId: id,
        entityName: caseData?.case_no || caseData?.title || 'Reliability Case',
        actionUrl: `/reliability/cases/${id}`,
        queryParams: {},
        sourceUserId: String(user._id),
        type,
        message
      });
    } catch (error) {
      console.error('Reliability notification failed:', error);
    }
  }

  private async notifyReliabilityCaseStatus(caseData: any, user: ReliabilityCaseActor): Promise<void> {
    const status = String(caseData?.status || '');
    const typeByStatus: Record<string, string> = {
      approval_pending: 'RELIABILITY_CASE_APPROVAL_PENDING',
      approved: 'RELIABILITY_CASE_APPROVED',
      rejected: 'RELIABILITY_CASE_REJECTED',
      work_order_created: 'RELIABILITY_CASE_WORK_ORDER_LINKED',
      feedback_pending: 'RELIABILITY_CASE_FEEDBACK_PENDING',
      closed: 'RELIABILITY_CASE_CLOSED',
      snoozed: 'RELIABILITY_CASE_SNOOZED'
    };
    const type = typeByStatus[status];
    if (!type) return;
    await this.notifyReliabilityCase(caseData, user, 'updated', type, `Reliability case ${caseData.case_no} is now ${this.formatStatusText(status)}.`);
  }

  private formatStatusText(status: string): string {
    return String(status || 'updated').replace(/_/g, ' ');
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
