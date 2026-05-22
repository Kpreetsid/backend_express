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

  body('faults')
    .optional()
    .isArray().withMessage('Faults must be an array')
];
