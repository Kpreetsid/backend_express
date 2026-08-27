import { body } from 'express-validator';

export const COMMENT_MAX_LENGTH = 5_000;

export const commentValidator = [
  body('comments')
    .isString().withMessage('Comment must be a string')
    .trim()
    .notEmpty().withMessage('Comment text is required')
    .isLength({ max: COMMENT_MAX_LENGTH }).withMessage(`Comment must not exceed ${COMMENT_MAX_LENGTH} characters`),
  
  body('parentCommentId')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Parent Comment ID format')
];
