import { body } from 'express-validator';

export const locationValidator = [
  body('location_name')
    .notEmpty().withMessage('Location name is required')
    .isString().withMessage('Location name must be a string')
    .trim(),
  
  body('location_type')
    .notEmpty().withMessage('Location type is required')
    .isString().withMessage('Location type must be a string')
    .trim(),

  body('top_level')
    .optional()
    .isBoolean().withMessage('Top level must be a boolean'),

  body('parent_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Parent Location ID format'),

  body('image_path')
    .optional()
    .isString().withMessage('Image path must be a string')
];
