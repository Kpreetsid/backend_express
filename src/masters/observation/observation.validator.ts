import { body } from 'express-validator';

export const observationValidator = [
  body('observation')
    .notEmpty().withMessage('Observation is required')
    .isString().withMessage('Observation must be a string')
    .trim(),
  
  body('recommendation')
    .notEmpty().withMessage('Recommendation is required')
    .isString().withMessage('Recommendation must be a string')
    .trim(),

  body('assetId')
    .notEmpty().withMessage('Asset ID is required')
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('status')
    .notEmpty().withMessage('Status is required')
    .isString().withMessage('Status must be a string')
    .trim(),

  body('locationId')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('top_level_asset_id')
    .notEmpty().withMessage('Top level asset ID is required')
    .isMongoId().withMessage('Invalid Top level asset ID format'),

  body('alarmReasons')
    .optional()
    .isArray().withMessage('Alarm reasons must be an array')
    .bail()
    .custom((reasons: unknown[]) => reasons.every(reason => typeof reason === 'string' && reason.trim().length > 0))
    .withMessage('Alarm reasons must contain non-empty strings'),

  body('alarmOtherReason')
    .if((value, { req }) => value !== undefined
      || (Array.isArray(req.body.alarmReasons) && req.body.alarmReasons.includes('Other (Specify Reason)')))
    .isString().withMessage('Other alarm reason must be a string')
    .bail()
    .trim()
    .custom((value: string, { req }) => !Array.isArray(req.body.alarmReasons) || !req.body.alarmReasons.includes('Other (Specify Reason)') || value.length > 0)
    .withMessage('Other alarm reason is required when Other is selected'),

  body('faults')
    .optional()
    .isArray().withMessage('Faults must be an array')
];
