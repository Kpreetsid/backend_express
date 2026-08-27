import { body } from 'express-validator';

export const partTypeValidator = [
  body('name')
    .notEmpty().withMessage('Part type name is required')
    .isString().withMessage('Part type name must be a string')
    .trim()
    .isLength({ max: 120 }).withMessage('Part type name must not exceed 120 characters'),
  
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters')
];
