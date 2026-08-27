import { body } from 'express-validator';

export const analysisFeatureUpdateValidator = [
  body('featuresJson')
    .isArray({ min: 1 }).withMessage('A non-empty analysis feature list is required')
];
