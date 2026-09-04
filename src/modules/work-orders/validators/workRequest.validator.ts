import { body } from 'express-validator';

export const workRequestValidator = [
  body('request_no')
    .optional()
    .isString().withMessage('Request number must be a string')
    .trim(),

  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  
  body('problemType')
    .notEmpty().withMessage('Problem type is required')
    .isString().withMessage('Problem type must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Problem type cannot exceed 100 characters'),

  body('priority')
    .optional()
    .isIn(['None', 'Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Invalid priority level'),

  body('location_id')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('asset_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 10000 }).withMessage('Description cannot exceed 10000 characters'),

  body('remarks')
    .optional()
    .isString().withMessage('Remarks must be a string')
    .trim()
    .isLength({ max: 2000 }).withMessage('Remarks cannot exceed 2000 characters'),

  body('files')
    .optional()
    .isArray({ max: 20 }).withMessage('A maximum of 20 files is allowed'),

  body('tags')
    .optional()
    .isArray({ max: 50 }).withMessage('A maximum of 50 tags is allowed'),
  body('tags.*')
    .optional()
    .isString().withMessage('Every tag must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Tags cannot exceed 100 characters'),

  body('review_sla_hours')
    .optional()
    .isNumeric().withMessage('Review SLA hours must be a number'),

  body('order_sla_hours')
    .optional()
    .isNumeric().withMessage('Order SLA hours must be a number')
];
