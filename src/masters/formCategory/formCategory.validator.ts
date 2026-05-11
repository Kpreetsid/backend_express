import { body } from 'express-validator';

export const categoryValidator = [
  body('name')
    .notEmpty().withMessage('Category name is required')
    .isString().withMessage('Category name must be a string')
    .trim(),
  
  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .trim()
];
