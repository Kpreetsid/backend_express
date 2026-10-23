import { body } from 'express-validator';

export const instructionValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('WI_steps')
    .optional()
    .isArray().withMessage('Work instruction steps must be an array'),

  body('WI_steps.*.title')
    .if(body('WI_steps').exists())
    .notEmpty().withMessage('Step title is required'),

  body('WI_steps.*.description')
    .if(body('WI_steps').exists())
    .notEmpty().withMessage('Step description is required')
];
