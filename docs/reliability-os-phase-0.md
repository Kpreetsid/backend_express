# Reliability OS Phase 0 Design Lock

Status: approved for Phase 1 planning
Branch: reliability
Scope: cmmsF, backend_express, data_processors

## 1. Phase 0 Objective

Phase 0 locks the migration design before Phase 1 implementation. The goal is to transform the current alert-heavy monitoring flow into a workflow-led reliability system without rewriting the existing stack.

Primary product move:

Alerts become Reliability Cases.

System ownership decision:

- Express + MongoDB owns workflow state, permissions, approvals, audit, work orders, parts, and reliability cases.
- Django + Postgres/Timescale-style sensor tables owns sensor ingestion, alert history, health scoring, diagnostics, chart evidence, and high-volume time-series data.
- Angular owns the unified Reliability OS user experience and will gradually de-emphasize raw alarm-wall views.

## 2. Current Architecture Summary

### Angular frontend: cmmsF

Current role:

- User login, dashboard, PDM, alarm module, asset health, alarm detail, asset reports, work requests, work orders, parts, inspections, preventive maintenance, SOP/library surfaces.
- Calls Express through `environment.apiUrl`.
- Calls Django processor APIs through `environment.apiUrlDashboardLive`.
- Uses Socket.IO notifications from Express.

Important existing frontend areas:

- `src/app/default/dashboard/pdm`
- `src/app/default/alarm-module`
- `src/app/default/assets/alarms-notifications`
- `src/app/default/assets/asset-report`
- `src/app/default/work-order`
- `src/app/default/work-request`
- `src/app/default/parts`
- `src/app/default/library`

### Express backend: backend_express

Current role:

- User/account/location/asset master data.
- Work request and work order workflow.
- Procedures, work instructions, SOPs, troubleshooting guides.
- Parts and inventory movement.
- Observations, posts, notifications, role menus.
- Mongoose models and module routes under `/api`.

Important existing models to reuse:

- `AssetModel`
- `LocationModel`
- `UserModel`
- `RoleMenuModel`
- `ObservationModel`
- `ReportAssetModel`
- `WorkRequestModel`
- `WorkOrderModel`
- `WorkOrderActivityModel`
- `PartsModel`
- `InventoryMovementModel`
- `ProcedureModel`
- `SOPsModel`
- `TroubleshootGuideModel`
- `Notification`

### Django processor: data_processors

Current role:

- MQTT and API sensor ingestion.
- Postgres sensor/time-series storage.
- Celery/Redis processing.
- Thresholds, dynamic thresholds, alarm history, alarm queue.
- Asset health score/history.
- Vibration/MCSA analytics.
- Rule-based diagnostics and diagnostic report persistence.
- Chart evidence APIs.

Important existing models to reuse:

- `DeviceMountMaster`
- `AlarmHistoryMaster`
- `AlarmQueueMaster`
- `AssetHealthMaster`
- `AssetHealthHistoryMaster`
- `ThresholdValues`
- `RuleBaseDiagnosticsMaster`
- `AssetDiagnosticReportMaster`
- `VelocityStatTimeMaster`, `AccelerationStatTimeMaster`, optimized variants
- Raw/time/frequency/envelope/MCSA sensor tables

## 3. Source Of Truth Decisions

### Workflow state

Source of truth: Express.

Reason:

- Existing roles, permissions, work requests, work orders, parts, procedures, and audit already live there.
- Reliability Case is an operational workflow object, not a time-series object.

### Sensor evidence and diagnostics

Source of truth: Django.

Reason:

- Alarm history, diagnostic reports, health scoring, raw sensor evidence, and chart APIs already live there.
- Duplicating raw data in MongoDB would create scale and consistency problems.

### Snapshot policy

Reliability Case should store evidence snapshots, not raw time-series data.

Store in Express:

- Linked Django alarm IDs.
- Linked diagnostic report IDs.
- Human-readable alarm snapshot.
- Diagnosis summary snapshot.
- Health/status snapshot at case creation or refresh.
- Evidence references for charts.

Do not store in Express:

- Raw waveform arrays.
- Full spectrum arrays.
- Bulk time-series readings.

## 4. Reliability Case Lifecycle

Initial statuses:

- `open`: created, not yet triaged.
- `triaged`: related alarms/evidence reviewed.
- `diagnosed`: likely failure mode/root cause assigned.
- `recommendation_ready`: maintenance action generated.
- `approval_pending`: waiting for authorized approval.
- `approved`: recommendation approved for execution.
- `work_order_created`: linked work order exists.
- `in_progress`: execution underway.
- `feedback_pending`: work is done but feedback/closure learning missing.
- `closed`: final root cause/outcome captured.
- `rejected`: case dismissed with reason.
- `snoozed`: temporarily deferred with revisit time.

Terminal statuses:

- `closed`
- `rejected`

Status transition rules:

- `open` -> `triaged`, `rejected`, `snoozed`
- `triaged` -> `diagnosed`, `rejected`, `snoozed`
- `diagnosed` -> `recommendation_ready`
- `recommendation_ready` -> `approval_pending`
- `approval_pending` -> `approved`, `rejected`
- `approved` -> `work_order_created`
- `work_order_created` -> `in_progress`, `feedback_pending`
- `in_progress` -> `feedback_pending`
- `feedback_pending` -> `closed`

High-risk cases require approval before work-order creation.

## 5. Phase 1 Model Contract

Phase 1 should add the following Express model. Field names use the current Mongo/Mongoose style.

```ts
ReliabilityCase {
  account_id: ObjectId;
  case_no: string;
  title: string;
  description?: string;

  asset_id: ObjectId;
  top_level_asset_id?: ObjectId;
  location_id: ObjectId;

  status: ReliabilityCaseStatus;
  risk_level: "None" | "Low" | "Medium" | "High" | "Urgent";
  urgency?: "monitor" | "plan" | "schedule" | "immediate";

  asset_criticality?: "low" | "medium" | "high" | "critical";
  detected_at?: Date;
  first_alarm_at?: Date;
  latest_alarm_at?: Date;

  linked_alarms: ReliabilityCaseAlarmRef[];
  evidence_snapshot: ReliabilityCaseEvidenceSnapshot;
  diagnosis_snapshot?: ReliabilityCaseDiagnosisSnapshot;
  recommendation_snapshot?: ReliabilityCaseRecommendationSnapshot;

  approval?: ReliabilityCaseApproval;
  linked_work_order_id?: ObjectId;
  linked_work_order_no?: string;

  technician_feedback?: ReliabilityCaseTechnicianFeedback;
  closure?: ReliabilityCaseClosure;

  status_history: ReliabilityCaseStatusHistory[];
  audit_log: ReliabilityCaseAuditEntry[];

  visible: boolean;
  createdBy: ObjectId;
  updatedBy?: ObjectId;
}
```

Supporting embedded objects:

```ts
ReliabilityCaseAlarmRef {
  source: "alarm_history" | "alarm_queue";
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
}

ReliabilityCaseEvidenceSnapshot {
  health_status?: string;
  health_score?: number;
  worst_kpi?: any;
  symptoms: string[];
  sensor_evidence: Array<{
    composite?: string;
    mount_id?: string;
    endpoint_name?: string;
    metric?: string;
    axis?: string;
    observed_value?: number;
    threshold_value?: number;
    timestamp?: Date;
  }>;
  chart_refs: Array<{
    label: string;
    source: "django";
    api: string;
    payload: any;
  }>;
}

ReliabilityCaseDiagnosisSnapshot {
  likely_failure_mode?: string;
  likely_root_cause?: string;
  confidence?: "low" | "medium" | "high";
  confidence_score?: number;
  diagnosis_source: "django_rule" | "case_rule" | "human" | "llm_assisted";
  summary?: string;
  observations: string[];
  recommendations: string[];
  severity_assessment?: string;
  maintenance_priority?: string;
  fault_timeline?: any[];
  limitations?: string[];
}

ReliabilityCaseRecommendationSnapshot {
  action_summary: string;
  inspection_steps: string[];
  maintenance_actions: string[];
  safety_checklist: string[];
  suggested_spares: Array<{
    part_id?: ObjectId;
    part_name: string;
    part_number?: string;
    quantity: number;
    confidence?: "low" | "medium" | "high";
  }>;
  suggested_tools: string[];
  suggested_procedure_ids: ObjectId[];
  suggested_assignee_ids: ObjectId[];
  estimated_downtime_hours?: number;
  business_impact?: {
    downtime_cost?: number;
    production_risk?: "low" | "medium" | "high";
    safety_risk?: "low" | "medium" | "high";
    cost_of_delay?: number;
    currency?: string;
  };
  explanation: string;
  generated_by: "rule" | "human" | "llm_assisted";
}
```

## 6. Alert-To-Case Mapping

Initial mapping from Django alarm to Express case:

| Alarm field | Reliability Case field |
| --- | --- |
| `AlarmHistoryMaster.id` | `linked_alarms[].alarm_id` |
| `asset_id` | mapped to Express `AssetModel._id` |
| `priority` | `risk_level` seed |
| `signal_type`, `trend_type`, `axis` | symptoms and evidence |
| `composite`, `sensor_location` | sensor evidence |
| `threshold_value`, `observed_value` | sensor evidence |
| `timestamp` | alarm timestamps |
| `report_id` or diagnostic report relation | diagnosis snapshot reference |

Risk seed:

- `Critical` -> `Urgent`
- `Danger` -> `High`
- `Alert` -> `Medium`
- unknown -> `Low`

Case title seed:

`{asset_name}: {priority} {signal_type}/{trend_type} anomaly`

## 7. Grouping Rules For Phase 1 And Phase 2

Phase 1 should support manual selection and single-alarm case creation.

Phase 2 should add automatic grouping.

Initial grouping rules:

- Same account.
- Same top-level asset or same asset subtree.
- Alarm timestamp within configurable window, default 24 hours.
- Related signal family:
  - vibration velocity/acceleration/envelope/bearing -> mechanical case
  - temperature -> thermal case
  - current/MCSA -> electrical or runtime case
- Similar severity family, or severity escalation on same asset.
- Same likely fault family when diagnostic report exists.

Duplicate prevention:

- If an open case exists for same asset subtree and same fault family within the active window, attach the alarm instead of creating a new case.
- Critical alarms can reopen or escalate a snoozed/open related case.

## 8. API Contract For Phase 1

Express routes should be mounted under:

`/api/reliability/cases`

Initial endpoints:

- `GET /api/reliability/cases`
- `GET /api/reliability/cases/:id`
- `POST /api/reliability/cases`
- `POST /api/reliability/cases/from-alert`
- `POST /api/reliability/cases/from-alerts`
- `PATCH /api/reliability/cases/:id/status`
- `POST /api/reliability/cases/:id/notes`
- `POST /api/reliability/cases/:id/refresh-evidence`
- `POST /api/reliability/cases/:id/link-work-order`

Phase 2+ endpoints:

- `POST /api/reliability/cases/group-alerts`
- `POST /api/reliability/cases/:id/recommendation`
- `POST /api/reliability/cases/:id/approval`
- `POST /api/reliability/cases/:id/work-order-draft`
- `POST /api/reliability/cases/:id/create-work-order`
- `POST /api/reliability/cases/:id/feedback`
- `POST /api/reliability/cases/:id/close`

## 9. Django Evidence Adapter Contract

Express should call Django through a small adapter, not scatter HTTP calls through controllers.

Adapter responsibilities:

- Fetch alarm history by IDs.
- Fetch health snapshot for asset IDs.
- Fetch latest diagnostic reports for alarm IDs or asset ID.
- Build chart reference payloads, not chart data arrays.
- Normalize Django string asset IDs to Express ObjectIds.

Required Django endpoints or equivalent:

- Alarm history by IDs.
- Diagnostic reports by `alarm_source` and `alarm_id`.
- Asset health status by asset.
- Chart APIs already used by Angular for velocity/acceleration evidence.

Phase 0 verification item:

Angular calls `get_alarm_diagnostic_reports/`, but this route was not found in the inspected `app/urls.py`. Before Phase 1 integration, confirm whether this endpoint exists in deployed code, another branch, a proxy rewrite, or must be added.

## 10. Frontend Route And UX Contract

Initial Angular route:

`/reliability/cases`

Initial screens:

- Reliability case list.
- Reliability case detail.
- Create case from alarm action.
- Linked alarm evidence panel.
- Diagnosis snapshot panel.
- Status and assignment panel.

Navigation:

- Keep current alarm pages.
- Add case entry points from:
  - alarm module
  - asset alarm detail
  - asset health page
  - future command center

UX rule:

Alerts are evidence. Cases are the work object.

## 11. Roles And Permissions

Keep existing `USER_ROLES` for now:

- `admin`
- `manager`
- `employee`
- `customer`
- `user`

Add role menu keys rather than introducing new user roles immediately.

Proposed `roleMenu.reliabilityCase` actions:

- `view_case`
- `create_case`
- `edit_case`
- `triage_case`
- `diagnose_case`
- `generate_recommendation`
- `approve_recommendation`
- `reject_case`
- `create_work_order_from_case`
- `add_feedback`
- `close_case`
- `view_business_impact`
- `manage_failure_library`

Suggested mapping:

- Plant head: view, approve high-risk, view business impact.
- Maintenance head: view, triage, approve, assign, create work order, close.
- Reliability engineer: create, triage, diagnose, recommend, close.
- Technician: view assigned cases/work orders, add feedback, upload evidence.
- Store/inventory manager: view spares and update stock.
- Production manager: view risk, downtime windows, approval visibility.
- Admin: all permissions.
- External consultant/OEM: read-only or diagnose/recommend depending on contract.

## 12. Phase 0 Open Questions

Resolved decisions:

1. Case IDs use account-scoped sequential format: `RC-2026-000001`.
2. Phase 1 creates cases from `AlarmHistoryMaster` only.
3. Default grouping window for Phase 2 is 24 hours.
4. Recommendation approval is allowed for `admin` and `manager` users with role-menu permission.
5. Reliability Case data stays only in Express/MongoDB. Django does not receive a case back-reference in the MVP.
6. Local development should use local Django processor URLs instead of a mock evidence adapter.
7. Asset Reports remain separate initially, then gradually become part of Reliability Cases.

## 13. Phase 1 Implementation Gate

Do not start Phase 1 coding until these are approved:

- Reliability Case lifecycle statuses.
- Initial schema fields.
- API route prefix.
- Case number format: `RC-2026-000001`.
- First evidence source: `AlarmHistoryMaster` only.
- Role-menu permissions.
- Local development evidence strategy: local Django URLs.

## 14. Recommended Phase 1 Build Order

1. Add Express reliability module skeleton.
2. Add `ReliabilityCase` model and indexes.
3. Add route/controller/service/validator structure.
4. Add case number generator.
5. Add create/list/detail/status APIs.
6. Add Django evidence adapter with mocked fallback if needed.
7. Add Angular route and case list/detail shell.
8. Add "Create Reliability Case" action from alarm detail.
9. Add basic notifications for case created/status changed.
10. Add minimal tests/typecheck.

## 15. Acceptance Criteria For Phase 0

Phase 0 is complete when:

- All three repos are confirmed on `reliability`.
- Source-of-truth decisions are documented.
- Phase 1 model and API contracts are approved.
- Open questions are answered or explicitly deferred.
- No application behavior has changed.

Phase 0 approval notes:

- Case numbers: `RC-2026-000001`.
- Alarm source: `AlarmHistoryMaster`.
- Grouping window: 24 hours.
- Approval roles: `admin`, plus `manager` with `approve_recommendation`.
- Case persistence: Express/MongoDB only.
- Local evidence: local Django processor URLs.
- Asset Reports: gradually folded into Reliability Cases.
