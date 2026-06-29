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
}

export interface UpdateCaseStatusPayload {
  status: ReliabilityCaseStatus;
  note?: string;
}
