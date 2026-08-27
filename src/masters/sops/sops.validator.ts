import { body } from 'express-validator';
import { sanitizeStructuredPayload } from '../../utils/structuredPayload';

export const sopsValidator = [
  body('name')
    .notEmpty().withMessage('SOP name is required')
    .isString().withMessage('SOP name must be a string')
    .trim()
    .isLength({ max: 160 }).withMessage('SOP name must not exceed 160 characters'),
  
  body('locationId')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('categoryId')
    .notEmpty().withMessage('Category ID is required')
    .isMongoId().withMessage('Invalid Category ID format'),

  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 4000 }).withMessage('Description must not exceed 4000 characters'),

  body('json_temp')
    .optional({ nullable: true })
    .isObject().withMessage('Form template must be an object')
    .custom((value) => {
      sanitizeStructuredPayload(value, 'Form template');
      return true;
    })
];

export const updateSopsValidator = [
  body('name')
    .optional({ nullable: true })
    .isString().withMessage('SOP name must be a string')
    .trim()
    .notEmpty().withMessage('SOP name must not be empty')
    .isLength({ max: 160 }).withMessage('SOP name must not exceed 160 characters'),
  body('locationId').optional({ nullable: true }).isMongoId().withMessage('Invalid Location ID format'),
  body('categoryId').optional({ nullable: true }).isMongoId().withMessage('Invalid Category ID format'),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  body('json_temp')
    .optional({ nullable: true })
    .isObject().withMessage('Form template must be an object')
    .custom((value) => {
      sanitizeStructuredPayload(value, 'Form template');
      return true;
    })
];
