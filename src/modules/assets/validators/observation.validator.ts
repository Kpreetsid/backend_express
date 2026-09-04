import { body } from 'express-validator';
import { OBSERVATION_LIMITS, OBSERVATION_STATUSES } from '../policies/observation.policy';

const mutableObservationValidators = [
  body('observation')
    .notEmpty().withMessage('Observation is required')
    .isString().withMessage('Observation must be a string')
    .isLength({ max: OBSERVATION_LIMITS.richText * 2 }).withMessage('Observation is too long')
    .trim(),
  body('recommendation')
    .notEmpty().withMessage('Recommendation is required')
    .isString().withMessage('Recommendation must be a string')
    .isLength({ max: OBSERVATION_LIMITS.richText * 2 }).withMessage('Recommendation is too long')
    .trim(),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isString().withMessage('Status must be a string')
    .isIn(OBSERVATION_STATUSES).withMessage('Invalid status')
    .trim(),
  body('faults')
    .optional()
    .isArray({ max: OBSERVATION_LIMITS.faults }).withMessage('Faults must be a bounded array'),
  body('faults.*')
    .optional()
    .isString().withMessage('Each fault must be a string')
    .isLength({ max: OBSERVATION_LIMITS.faultLength }).withMessage('Fault is too long'),
  body('files')
    .optional()
    .isArray({ max: OBSERVATION_LIMITS.files }).withMessage('Files must be a bounded array')
];

export const observationCreateValidator = [
  ...mutableObservationValidators,
  body('assetId').notEmpty().withMessage('Asset ID is required').isMongoId().withMessage('Invalid Asset ID format'),
  body('locationId').notEmpty().withMessage('Location ID is required').isMongoId().withMessage('Invalid Location ID format'),
  body('top_level_asset_id').notEmpty().withMessage('Top level asset ID is required').isMongoId().withMessage('Invalid Top level asset ID format'),
  body('report_id').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Invalid Report ID format'),
  body('alarmId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1, max: OBSERVATION_LIMITS.alarmId }).withMessage('Invalid Alarm ID')
];

export const observationUpdateValidator = mutableObservationValidators;

// Compatibility for imports outside this module.
export const observationValidator = observationCreateValidator;
