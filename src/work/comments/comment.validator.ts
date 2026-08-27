import { body } from 'express-validator';

export const commentValidator = [
  body('comments')
    .notEmpty().withMessage('Comment text is required')
    .isString().withMessage('Comment must be a string')
    .isLength({ max: 5000 }).withMessage('Comment cannot exceed 5000 characters')
    .trim(),
  
  body('order_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Order ID format'),

  body('post_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Post ID format'),

  body('parentCommentId')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Parent Comment ID format')
];
