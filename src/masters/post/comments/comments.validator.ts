import { body } from 'express-validator';

export const commentValidator = [
  body('comments')
    .notEmpty().withMessage('Comment text is required')
    .isString().withMessage('Comment must be a string')
    .trim(),
  
  body('parentCommentId')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Parent Comment ID format')
];
