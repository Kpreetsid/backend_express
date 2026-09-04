import { body } from 'express-validator';

export const locationValidator = [
  body('location_name')
    .notEmpty().withMessage('Location name is required')
    .isString().withMessage('Location name must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Location name must not exceed 200 characters'),

  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 4000 }).withMessage('Description must not exceed 4000 characters'),
  
  body('location_type')
    .notEmpty().withMessage('Location type is required')
    .isString().withMessage('Location type must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Location type must not exceed 100 characters'),

  body('top_level')
    .optional()
    .isBoolean().withMessage('Top level must be a boolean'),

  body('parent_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Parent Location ID format'),

  body('top_level_location_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid top-level location ID format'),

  body('image_path')
    .optional({ nullable: true })
    .isString().withMessage('Image path must be a string')
    .trim()
    .isLength({ max: 255 }).withMessage('Image path must not exceed 255 characters'),

  body('userIdList')
    .isArray({ min: 1, max: 500 }).withMessage('Select between 1 and 500 users'),

  body('userIdList.*')
    .isMongoId().withMessage('Every selected user ID must be valid'),
];
