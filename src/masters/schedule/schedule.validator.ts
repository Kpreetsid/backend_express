import { body } from 'express-validator';

export const scheduleValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('schedule')
    .notEmpty().withMessage('Schedule is required')
    .isObject().withMessage('Schedule must be an object'),

  body('schedule.mode')
    .notEmpty().withMessage('Schedule mode is required')
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Invalid schedule mode'),

  body('schedule.start_date')
    .notEmpty().withMessage('Start date is required')
    .isString().withMessage('Start date must be a string'),

  body('work_order')
    .notEmpty().withMessage('Work order template is required')
    .isObject().withMessage('Work order must be an object'),

  body('work_order.title')
    .notEmpty().withMessage('Work order title is required')
    .isString().withMessage('Work order title must be a string')
    .trim(),

  body('work_order.wo_location_id')
    .notEmpty().withMessage('Work order location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('work_order.wo_asset_id')
    .notEmpty().withMessage('Work order asset ID is required')
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('work_order.userIdList')
    .notEmpty().withMessage('User ID list is required')
    .isArray().withMessage('User ID list must be an array')
];
