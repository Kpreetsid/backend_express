import { body } from 'express-validator';

export const postValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('postType')
    .notEmpty().withMessage('Post type is required')
    .isString().withMessage('Post type must be a string')
    .trim(),

  body('relatedTo')
    .notEmpty().withMessage('Related to is required')
    .isString().withMessage('Related to must be a string')
    .trim(),

  body('description')
    .notEmpty().withMessage('Description is required')
    .isString().withMessage('Description must be a string')
    .trim(),

  body('publishTo')
    .optional()
    .isArray().withMessage('Publish to must be an array')
];
