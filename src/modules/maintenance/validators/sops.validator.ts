import { body } from 'express-validator';

export const sopsValidator = [
  body('name')
    .notEmpty().withMessage('SOP name is required')
    .isString().withMessage('SOP name must be a string')
    .trim(),
  
  body('locationId')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('categoryId')
    .notEmpty().withMessage('Category ID is required')
    .isMongoId().withMessage('Invalid Category ID format'),

  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .trim(),

  body('json_temp')
    .optional()
    .isObject().withMessage('Form template must be an object')
];
