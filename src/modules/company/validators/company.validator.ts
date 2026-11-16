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

export const sensorEmailValidator = [
  body('usersDetail').isArray({ max: 500 }).withMessage('usersDetail must be an array of at most 500 users'),
  body('usersDetail.*').custom(value => {
    const allowed = ['user_id', 'firstName', 'lastName', 'email', 'user_role'];
    return value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).every(key => allowed.includes(key));
  }).withMessage('Invalid user details'),
  body('usersDetail.*.user_id').isMongoId().withMessage('A valid user ID is required'),
  body('usersDetail.*.email').optional().isString().bail().trim().isEmail().withMessage('Invalid email address'),
  ...['firstName', 'lastName', 'user_role'].map(field =>
    body('usersDetail.*.' + field).optional().isString().bail().trim().isLength({ max: 100 }).withMessage('Invalid user details'))
];
