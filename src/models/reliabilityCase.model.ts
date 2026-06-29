import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from 'mongodb';

export const RELIABILITY_CASE_STATUSES = [
  'open',
  'triaged',
  'diagnosed',
  'recommendation_ready',
  'approval_pending',
  'approved',
  'work_order_created',
  'in_progress',
  'feedback_pending',
  'closed',
  'rejected',
  'snoozed'
] as const;

export const RELIABILITY_CASE_RISK_LEVELS = ['None', 'Low', 'Medium', 'High', 'Urgent'] as const;
export const RELIABILITY_CASE_URGENCY_LEVELS = ['monitor', 'plan', 'schedule', 'immediate'] as const;

export type ReliabilityCaseStatus = typeof RELIABILITY_CASE_STATUSES[number];
export type ReliabilityCaseRiskLevel = typeof RELIABILITY_CASE_RISK_LEVELS[number];
export type ReliabilityCaseUrgency = typeof RELIABILITY_CASE_URGENCY_LEVELS[number];

export interface IReliabilityCaseAlarmRef {
  source: 'alarm_history';
  alarm_id: string;
  asset_id?: string;
  composite?: string;
  signal_type?: string;
  trend_type?: string;
  axis?: string;
  priority?: string;
  sensor_location?: string;
  threshold_value?: number;
  observed_value?: number;
  timestamp?: Date;
  diagnostic_report_id?: string;
  report_created?: boolean;
  report_id?: string;
}

export interface IReliabilityCaseEvidenceSnapshot {
  health_status?: string;
  health_score?: number;
  worst_kpi?: Record<string, unknown>;
  symptoms: string[];
  sensor_evidence: Record<string, unknown>[];
  chart_refs: Record<string, unknown>[];
}

export interface IReliabilityCaseDiagnosisSnapshot {
  likely_failure_mode?: string;
  likely_root_cause?: string;
  confidence?: 'low' | 'medium' | 'high';
  confidence_score?: number;
  diagnosis_source: 'django_rule' | 'case_rule' | 'human' | 'llm_assisted';
  summary?: string;
  observations: string[];
  recommendations: string[];
  severity_assessment?: string;
  maintenance_priority?: string;
  fault_timeline?: unknown[];
  limitations?: string[];
}

export interface IReliabilityCaseStatusHistory {
  status: ReliabilityCaseStatus;
  createdBy: ObjectId;
  createdAt: Date;
  note?: string;
}

export interface IReliabilityCaseAuditEntry {
  action: string;
  note?: string;
  metadata?: Record<string, unknown>;
  actor_id?: ObjectId;
  actor_name?: string;
  createdAt: Date;
}

export interface IReliabilityCase extends Document {
  account_id: ObjectId;
  case_no: string;
  title: string;
  description?: string;
  asset_id: ObjectId;
  top_level_asset_id?: ObjectId;
  location_id: ObjectId;
  status: ReliabilityCaseStatus;
  risk_level: ReliabilityCaseRiskLevel;
  urgency?: ReliabilityCaseUrgency;
  asset_criticality?: 'low' | 'medium' | 'high' | 'critical';
  detected_at?: Date;
  first_alarm_at?: Date;
  latest_alarm_at?: Date;
  linked_alarms: IReliabilityCaseAlarmRef[];
  evidence_snapshot: IReliabilityCaseEvidenceSnapshot;
  diagnosis_snapshot?: IReliabilityCaseDiagnosisSnapshot;
  recommendation_snapshot?: Record<string, unknown>;
  approval?: Record<string, unknown>;
  linked_work_order_id?: ObjectId;
  linked_work_order_no?: string;
  technician_feedback?: Record<string, unknown>;
  closure?: Record<string, unknown>;
  status_history: IReliabilityCaseStatusHistory[];
  audit_log: IReliabilityCaseAuditEntry[];
  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}

const AlarmRefSchema = new Schema<IReliabilityCaseAlarmRef>({
  source: { type: String, enum: ['alarm_history'], default: 'alarm_history', required: true },
  alarm_id: { type: String, required: true, trim: true },
  asset_id: { type: String, trim: true },
  composite: { type: String, trim: true },
  signal_type: { type: String, trim: true },
  trend_type: { type: String, trim: true },
  axis: { type: String, trim: true },
  priority: { type: String, trim: true },
  sensor_location: { type: String, trim: true },
  threshold_value: { type: Number },
  observed_value: { type: Number },
  timestamp: { type: Date },
  diagnostic_report_id: { type: String, trim: true },
  report_created: { type: Boolean },
  report_id: { type: String, trim: true }
}, { _id: false, versionKey: false });

const EvidenceSnapshotSchema = new Schema({
  health_status: { type: String, trim: true },
  health_score: { type: Number },
  worst_kpi: { type: Schema.Types.Mixed },
  symptoms: { type: [String], default: [] },
  sensor_evidence: { type: Array, default: [] },
  chart_refs: { type: Array, default: [] }
}, { _id: false, versionKey: false });

const DiagnosisSnapshotSchema = new Schema<IReliabilityCaseDiagnosisSnapshot>({
  likely_failure_mode: { type: String, trim: true },
  likely_root_cause: { type: String, trim: true },
  confidence: { type: String, enum: ['low', 'medium', 'high'] },
  confidence_score: { type: Number },
  diagnosis_source: { type: String, enum: ['django_rule', 'case_rule', 'human', 'llm_assisted'], default: 'django_rule' },
  summary: { type: String, trim: true },
  observations: { type: [String], default: [] },
  recommendations: { type: [String], default: [] },
  severity_assessment: { type: String, trim: true },
  maintenance_priority: { type: String, trim: true },
  fault_timeline: { type: [Schema.Types.Mixed], default: [] },
  limitations: { type: [String], default: [] }
}, { _id: false, versionKey: false });

const StatusHistorySchema = new Schema<IReliabilityCaseStatusHistory>({
  status: { type: String, enum: RELIABILITY_CASE_STATUSES, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Schema_User', required: true },
  createdAt: { type: Date, default: Date.now },
  note: { type: String, trim: true }
}, { _id: false, versionKey: false });

const AuditEntrySchema = new Schema<IReliabilityCaseAuditEntry>({
  action: { type: String, trim: true, required: true },
  note: { type: String, trim: true },
  metadata: { type: Schema.Types.Mixed },
  actor_id: { type: Schema.Types.ObjectId, ref: 'Schema_User' },
  actor_name: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false, versionKey: false });

const ReliabilityCaseSchema = new Schema<IReliabilityCase>({
  account_id: { type: Schema.Types.ObjectId, ref: 'AccountModel', required: true },
  case_no: { type: String, trim: true, required: true },
  title: { type: String, trim: true, required: true },
  description: { type: String, trim: true },
  asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel', required: true },
  top_level_asset_id: { type: Schema.Types.ObjectId, ref: 'AssetModel' },
  location_id: { type: Schema.Types.ObjectId, ref: 'LocationModel', required: true },
  status: { type: String, enum: RELIABILITY_CASE_STATUSES, default: 'open', required: true },
  risk_level: { type: String, enum: RELIABILITY_CASE_RISK_LEVELS, default: 'Low', required: true },
  urgency: { type: String, enum: RELIABILITY_CASE_URGENCY_LEVELS },
  asset_criticality: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  detected_at: { type: Date },
  first_alarm_at: { type: Date },
  latest_alarm_at: { type: Date },
  linked_alarms: { type: [AlarmRefSchema], default: [] },
  evidence_snapshot: { type: EvidenceSnapshotSchema, default: () => ({ symptoms: [], sensor_evidence: [], chart_refs: [] }) },
  diagnosis_snapshot: { type: DiagnosisSnapshotSchema },
  recommendation_snapshot: { type: Schema.Types.Mixed },
  approval: { type: Schema.Types.Mixed },
  linked_work_order_id: { type: Schema.Types.ObjectId, ref: 'Schema_WorkOrder' },
  linked_work_order_no: { type: String, trim: true },
  technician_feedback: { type: Schema.Types.Mixed },
  closure: { type: Schema.Types.Mixed },
  status_history: { type: [StatusHistorySchema], default: [] },
  audit_log: { type: [AuditEntrySchema], default: [] },
  visible: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Schema_User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Schema_User' }
}, {
  collection: 'reliability_cases',
  timestamps: true,
  versionKey: false
});

ReliabilityCaseSchema.index({ account_id: 1, case_no: 1 }, { unique: true });
ReliabilityCaseSchema.index({ account_id: 1, visible: 1, status: 1, updatedAt: -1 });
ReliabilityCaseSchema.index({ account_id: 1, asset_id: 1, visible: 1, status: 1 });
ReliabilityCaseSchema.index({ 'linked_alarms.alarm_id': 1 });
ReliabilityCaseSchema.index({ linked_work_order_id: 1 });

export const ReliabilityCaseModel = mongoose.model<IReliabilityCase>('Schema_ReliabilityCase', ReliabilityCaseSchema);
