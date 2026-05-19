import { body } from 'express-validator';

export const workRequestValidator = [
  body('request_no')
    .optional()
    .isString().withMessage('Request number must be a string')
    .trim(),

  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('problemType')
    .notEmpty().withMessage('Problem type is required')
    .isString().withMessage('Problem type must be a string')
    .trim(),

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
    .trim(),

  body('review_sla_hours')
    .optional()
    .isNumeric().withMessage('Review SLA hours must be a number'),

  body('order_sla_hours')
    .optional()
    .isNumeric().withMessage('Order SLA hours must be a number')
];
