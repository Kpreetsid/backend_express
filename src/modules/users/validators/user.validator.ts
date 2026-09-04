import { body } from 'express-validator';
import { isStrongPassword } from '../../../common/utils/password-policy.helper';

export const userValidator = [
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .isString().withMessage('First name must be a string')
    .trim(),
  
  body('username')
    .notEmpty().withMessage('Username is required')
    .isString().withMessage('Username must be a string')
    .trim(),

  body('password')
    .if(body('id').not().exists()) // Only required on create
    .notEmpty().withMessage('Password is required')
    .custom(isStrongPassword)
    .withMessage('Password must be at least 8 characters and include uppercase, lowercase, number and special character'),

  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('user_role')
    .notEmpty().withMessage('User role is required')
    .isIn(['admin', 'manager', 'employee', 'customer', 'user'])
    .withMessage('Invalid user role'),

  body('phone_no')
    .notEmpty().withMessage('Phone number is required')
    .isObject().withMessage('Phone number must be an object'),

  body('user_status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Invalid user status'),

  body('account_id')
    .optional()
    .isMongoId().withMessage('Invalid Account ID format')
];

export const userUpdateValidator = [
  body('firstName')
    .optional()
    .isString().withMessage('First name must be a string')
    .trim()
    .notEmpty().withMessage('First name cannot be empty'),

  body('lastName')
    .optional()
    .isString().withMessage('Last name must be a string')
    .trim(),

  body('username')
    .optional()
    .isString().withMessage('Username must be a string')
    .trim()
    .notEmpty().withMessage('Username cannot be empty'),

  body('email')
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('phone_no')
    .optional()
    .isObject().withMessage('Phone number must be an object'),

  body('user_status')
    .optional()
    .isIn(['active', 'inactive']).withMessage('Invalid user status'),

  body('user_role')
    .optional()
    .isIn(['admin', 'manager', 'employee', 'customer', 'user']).withMessage('Invalid user role'),

  body('isVerified')
    .optional()
    .isBoolean().withMessage('Verification status must be boolean'),

  body('user_profile_img')
    .optional()
    .isString().withMessage('Profile image name must be a string')
    .trim()
];
