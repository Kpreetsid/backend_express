import { body } from 'express-validator';
import {
  RELIABILITY_CASE_RISK_LEVELS,
  RELIABILITY_CASE_STATUSES,
  RELIABILITY_CASE_URGENCY_LEVELS
} from '../../models/reliabilityCase.model';

export const createCaseFromAlertsValidator = [
  body('alarm_ids')
    .isArray({ min: 1 })
    .withMessage('alarm_ids must be a non-empty array'),
  body('alarm_ids.*')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each alarm id must be a non-empty string'),
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 180 })
    .withMessage('title must be 180 characters or fewer'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('description must be 2000 characters or fewer'),
  body('grouping_window_hours')
    .optional()
    .isNumeric()
    .withMessage('grouping_window_hours must be a number')
];

export const createCaseFromAlertValidator = [
  body('alarm_id')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('alarm_id must be a non-empty string'),
  body('alarmId')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('alarmId must be a non-empty string'),
  body()
    .custom((value) => Boolean(value?.alarm_id || value?.alarmId))
    .withMessage('alarm_id is required'),
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 180 })
    .withMessage('title must be 180 characters or fewer'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('description must be 2000 characters or fewer')
];

export const createCaseFromAssetReportValidator = [
  body('asset_report_id')
    .isMongoId()
    .withMessage('asset_report_id must be a valid ObjectId'),
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 180 })
    .withMessage('title must be 180 characters or fewer'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('description must be 2000 characters or fewer')
];

export const updateCaseStatusValidator = [
  body('status')
    .isIn([...RELIABILITY_CASE_STATUSES])
    .withMessage('Invalid reliability case status'),
  body('note')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('note must be 1000 characters or fewer')
];

export const updateCaseValidator = [
  body('title')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('title cannot be empty')
    .isLength({ max: 180 })
    .withMessage('title must be 180 characters or fewer'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('description must be 2000 characters or fewer'),
  body('risk_level')
    .optional()
    .isIn([...RELIABILITY_CASE_RISK_LEVELS])
    .withMessage('risk_level is invalid'),
  body('urgency')
    .optional()
    .isIn([...RELIABILITY_CASE_URGENCY_LEVELS])
    .withMessage('urgency is invalid'),
  body()
    .custom((value) => ['title', 'description', 'risk_level', 'urgency'].some((field) => value?.[field] !== undefined))
    .withMessage('At least one editable case field is required')
];

export const addCaseNoteValidator = [
  body('note')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('note is required')
    .isLength({ max: 2000 })
    .withMessage('note must be 2000 characters or fewer')
];

export const linkWorkOrderValidator = [
  body('work_order_id')
    .isMongoId()
    .withMessage('work_order_id must be a valid ObjectId'),
  body('work_order_no')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 80 })
    .withMessage('work_order_no must be 80 characters or fewer')
];

export const recommendationValidator = [
  body('action_summary')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('action_summary must be 500 characters or fewer'),
  body('inspection_steps')
    .optional()
    .isArray()
    .withMessage('inspection_steps must be an array'),
  body('maintenance_actions')
    .optional()
    .isArray()
    .withMessage('maintenance_actions must be an array'),
  body('safety_checklist')
    .optional()
    .isArray()
    .withMessage('safety_checklist must be an array'),
  body('suggested_tools')
    .optional()
    .isArray()
    .withMessage('suggested_tools must be an array'),
  body('suggested_procedure_ids')
    .optional()
    .isArray()
    .withMessage('suggested_procedure_ids must be an array'),
  body('suggested_procedure_ids.*')
    .if(body('suggested_procedure_ids').exists())
    .isMongoId()
    .withMessage('suggested_procedure_ids must contain valid ObjectIds'),
  body('suggested_assignee_ids')
    .optional()
    .isArray()
    .withMessage('suggested_assignee_ids must be an array'),
  body('suggested_assignee_ids.*')
    .if(body('suggested_assignee_ids').exists())
    .isMongoId()
    .withMessage('suggested_assignee_ids must contain valid ObjectIds'),
  body('estimated_downtime_hours')
    .optional()
    .isNumeric()
    .withMessage('estimated_downtime_hours must be a number'),
  body('generated_by')
    .optional()
    .isIn(['rule', 'human', 'llm_assisted'])
    .withMessage('generated_by is invalid')
];

export const approvalValidator = [
  body('decision')
    .isIn(['approved', 'rejected'])
    .withMessage('decision must be approved or rejected'),
  body('note')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('note must be 1000 characters or fewer')
];

export const feedbackValidator = [
  body('work_performed')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('work_performed is required')
    .isLength({ max: 3000 })
    .withMessage('work_performed must be 3000 characters or fewer'),
  body('actual_failure_mode')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 300 })
    .withMessage('actual_failure_mode must be 300 characters or fewer'),
  body('root_cause')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('root_cause must be 500 characters or fewer'),
  body('parts_used')
    .optional()
    .isArray()
    .withMessage('parts_used must be an array'),
  body('downtime_hours')
    .optional()
    .isNumeric()
    .withMessage('downtime_hours must be a number'),
  body('effectiveness')
    .optional()
    .isIn(['resolved', 'improved', 'not_resolved', 'monitoring'])
    .withMessage('effectiveness is invalid'),
  body('follow_up_required')
    .optional()
    .isBoolean()
    .withMessage('follow_up_required must be a boolean'),
  body('follow_up_notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('follow_up_notes must be 1000 characters or fewer')
];

export const closeCaseValidator = [
  body('resolution_summary')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('resolution_summary is required')
    .isLength({ max: 3000 })
    .withMessage('resolution_summary must be 3000 characters or fewer'),
  body('final_failure_mode')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 300 })
    .withMessage('final_failure_mode must be 300 characters or fewer'),
  body('final_root_cause')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('final_root_cause must be 500 characters or fewer'),
  body('lessons_learned')
    .optional()
    .isArray()
    .withMessage('lessons_learned must be an array'),
  body('preventive_actions')
    .optional()
    .isArray()
    .withMessage('preventive_actions must be an array')
];
