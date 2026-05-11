import { body } from 'express-validator';

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
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),

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
