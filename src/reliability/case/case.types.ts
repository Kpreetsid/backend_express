import { ObjectId } from 'mongodb';
import { ReliabilityCaseStatus } from '../../models/reliabilityCase.model';

export interface ReliabilityCaseActor {
  _id: ObjectId;
  firstName?: string;
  lastName?: string;
  username?: string;
  user_role?: string;
  account_id: ObjectId;
}

export interface ProcessorAlarmEvidence {
  id: string | number;
  asset_id?: string;
  composite?: string;
  signal_type?: string;
  trend_type?: string;
  axis?: string;
  priority?: string;
  sensor_location?: string;
  threshold_value?: number | string | null;
  observed_value?: number | string | null;
  timestamp?: string;
  creation_date?: string;
  addressed?: boolean;
  report_created?: boolean;
  report_id?: string | null;
}

export interface ProcessorDiagnosticReport {
  id: string | number;
  asset_id?: string;
  alarm_history?: string | number | null;
  response_json?: any;
  report_json?: any;
  result?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessorHealthSnapshot {
  asset_id?: string;
  status?: string;
  score?: number | string | null;
  worst_kpi?: Record<string, unknown>;
}

export interface ProcessorReliabilityEvidenceResponse {
  alarms?: ProcessorAlarmEvidence[];
  diagnostic_reports?: ProcessorDiagnosticReport[];
  asset_health?: ProcessorHealthSnapshot[];
}

export interface CreateCaseFromAlertsPayload {
  alarm_ids: string[];
  title?: string;
  description?: string;
  grouping_window_hours?: number;
}

export interface CreateCaseFromAssetReportPayload {
  asset_report_id: string;
  title?: string;
  description?: string;
}

export interface UpdateCaseStatusPayload {
  status: ReliabilityCaseStatus;
  note?: string;
}

export interface RecommendationPayload {
  action_summary?: string;
  inspection_steps?: string[];
  maintenance_actions?: string[];
  safety_checklist?: string[];
  suggested_spares?: Record<string, unknown>[];
  suggested_tools?: string[];
  suggested_procedure_ids?: string[];
  suggested_assignee_ids?: string[];
  estimated_downtime_hours?: number;
  business_impact?: Record<string, unknown>;
  explanation?: string;
  generated_by?: 'rule' | 'human' | 'llm_assisted';
}

export interface ApprovalPayload {
  decision: 'approved' | 'rejected';
  note?: string;
}

export interface FeedbackPayload {
  work_performed: string;
  actual_failure_mode?: string;
  root_cause?: string;
  parts_used?: Record<string, unknown>[];
  downtime_hours?: number;
  effectiveness?: 'resolved' | 'improved' | 'not_resolved' | 'monitoring';
  follow_up_required?: boolean;
  follow_up_notes?: string;
}

export interface CloseCasePayload {
  resolution_summary: string;
  final_failure_mode?: string;
  final_root_cause?: string;
  lessons_learned?: string[];
  preventive_actions?: string[];
}
