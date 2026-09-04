import { body } from 'express-validator';
import { COOKIES_ENUM } from '../models/account.model';

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
    .isString().withMessage('Description must be a string'),

  body('cookie_status')
    .optional()
    .isIn(COOKIES_ENUM)
    .withMessage('Invalid cookie status'),


  body('encrypt_payload')
    .optional()
    .isIn(COOKIES_ENUM)
    .withMessage('Invalid payload encryption status'),

  body('encrypt_response')
    .optional()
    .isIn(COOKIES_ENUM)
    .withMessage('Invalid response encryption status')
];
