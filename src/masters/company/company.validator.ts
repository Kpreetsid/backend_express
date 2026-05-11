import { body } from 'express-validator';

export const companyValidator = [
  body('account_name')
    .notEmpty().withMessage('Company name is required')
    .isString().withMessage('Company name must be a string')
    .trim(),
  
  body('type')
    .notEmpty().withMessage('Company type is required')
    .isString().withMessage('Company type must be a string')
    .trim(),

  body('account_status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Invalid account status'),

  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
];
