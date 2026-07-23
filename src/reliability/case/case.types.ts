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

export interface CreateCaseFromAssetReportPayload {
  asset_report_id: string;
  title?: string;
  description?: string;
}

export interface UpdateCaseStatusPayload {
  status: ReliabilityCaseStatus;
  note?: string;
}

export interface UpdateCasePayload {
  title?: string;
  description?: string;
  risk_level?: 'None' | 'Low' | 'Medium' | 'High' | 'Urgent';
  urgency?: 'monitor' | 'plan' | 'schedule' | 'immediate';
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
