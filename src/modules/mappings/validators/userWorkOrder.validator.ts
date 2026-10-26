import { body } from 'express-validator';

export const userWorkOrderValidator = [
  body('workOrderId')
    .notEmpty().withMessage('Work Order ID is required')
    .isMongoId().withMessage('Invalid Work Order ID format'),

  body('userIdList')
    .isArray({ max: 200 }).withMessage('User ID list must be an array with at most 200 entries'),

  body('userIdList.*')
    .isMongoId().withMessage('Invalid User ID format in list')
];

export const updateUserWorkOrderValidator = [
  body('userIdList')
    .isArray({ max: 200 }).withMessage('User ID list must be an array with at most 200 entries'),
  body('userIdList.*')
    .isMongoId().withMessage('Invalid User ID format in list')
];
