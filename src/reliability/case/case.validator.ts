import { body } from 'express-validator';
import { RELIABILITY_CASE_STATUSES } from '../../models/reliabilityCase.model';

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
    .withMessage('description must be 2000 characters or fewer')
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
