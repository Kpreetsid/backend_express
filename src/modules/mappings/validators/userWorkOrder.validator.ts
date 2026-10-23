import { body } from 'express-validator';

export const userWorkOrderValidator = [
  body('workOrderId')
    .notEmpty().withMessage('Work Order ID is required')
    .isMongoId().withMessage('Invalid Work Order ID format'),

  body('userIdList')
    .notEmpty().withMessage('User ID list is required')
    .isArray({ min: 1 }).withMessage('User ID list must be a non-empty array'),

  body('userIdList.*')
    .isMongoId().withMessage('Invalid User ID format in list')
];
