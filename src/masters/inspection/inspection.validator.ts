import { body } from 'express-validator';

export const inspectionValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('start_date')
    .notEmpty().withMessage('Start date is required')
    .isString().withMessage('Start date must be a string')
    .trim(),

  body('form_id')
    .notEmpty().withMessage('Form ID is required')
    .isMongoId().withMessage('Invalid Form ID format'),

  body('location_id')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('asset_id')
    .notEmpty().withMessage('Asset ID is required')
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('status')
    .notEmpty().withMessage('Status is required')
    .isString().withMessage('Status must be a string')
    .trim(),

  body('month')
    .notEmpty().withMessage('Month is required')
    .isString().withMessage('Month must be a string')
    .trim(),

  body('createdFrom')
    .notEmpty().withMessage('Created From is required')
    .isString().withMessage('Created From must be a string')
    .trim()
];
