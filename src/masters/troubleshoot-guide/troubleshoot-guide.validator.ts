import { body } from 'express-validator';

export const troubleshootGuideValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('troubleshooting_steps')
    .notEmpty().withMessage('Troubleshooting steps are required')
    .isArray({ min: 1 }).withMessage('At least one troubleshooting step is required'),

  body('troubleshooting_steps.*.title')
    .notEmpty().withMessage('Step title is required'),

  body('troubleshooting_steps.*.description')
    .notEmpty().withMessage('Step description is required'),

  body('assetId')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('locationId')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Location ID format')
];
