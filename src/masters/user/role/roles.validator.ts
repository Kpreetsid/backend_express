import { body } from 'express-validator';

export const rolesValidator = [
  body('user_id')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid User ID format'),

  body('data')
    .notEmpty().withMessage('Role data is required')
    .isObject().withMessage('Role data must be an object'),

  body('roleMenu')
    .notEmpty().withMessage('Role menu configuration is required')
    .isObject().withMessage('Role menu must be an object')
];
