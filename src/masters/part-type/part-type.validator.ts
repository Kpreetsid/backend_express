import { body } from 'express-validator';

export const partTypeValidator = [
  body('name')
    .notEmpty().withMessage('Part type name is required')
    .isString().withMessage('Part type name must be a string')
    .trim(),
  
  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .trim()
];
