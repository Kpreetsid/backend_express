import { body } from 'express-validator';

export const categoryValidator = [
  body('name')
    .notEmpty().withMessage('Category name is required')
    .isString().withMessage('Category name must be a string')
    .trim()
    .isLength({ max: 120 }).withMessage('Category name must not exceed 120 characters'),
  
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters')
];

export const updateCategoryValidator = [
  body('name')
    .optional({ nullable: true })
    .isString().withMessage('Category name must be a string')
    .trim()
    .notEmpty().withMessage('Category name must not be empty')
    .isLength({ max: 120 }).withMessage('Category name must not exceed 120 characters'),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters')
];
