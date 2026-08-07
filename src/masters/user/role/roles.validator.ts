import { body } from 'express-validator';

const containsOnlyBooleanLeaves = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => {
    if (typeof entry === 'boolean') {
      return true;
    }
    return containsOnlyBooleanLeaves(entry);
  });
};

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

export const roleDataUpdateValidator = [
  body('data')
    .notEmpty().withMessage('Role data is required')
    .isObject().withMessage('Role data must be an object')
    .custom(containsOnlyBooleanLeaves)
    .withMessage('Role data permissions must be boolean values')
];
