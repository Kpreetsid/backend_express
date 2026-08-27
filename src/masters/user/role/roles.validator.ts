import { body } from 'express-validator';

export const createRoleValidator = [
  body('user_id')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid User ID format')
];

export const rolePermissionUpdateValidator = [
  body('data')
    .notEmpty().withMessage('Permission data is required')
    .isObject().withMessage('Permission data must be an object')
];

export const updateRoleValidator = [
  body('data')
    .notEmpty().withMessage('Role data is required')
    .isObject().withMessage('Role data must be an object')
];
