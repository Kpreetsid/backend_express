import { body } from 'express-validator';

export const assetValidator = [
  body('asset_name')
    .notEmpty().withMessage('Asset name is required')
    .isString().withMessage('Asset name must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Asset name must not exceed 200 characters'),
  
  body('asset_type')
    .notEmpty().withMessage('Asset type is required')
    .isIn(['Equipment', 'Motor', 'Flexible', 'Rigid', 'Belt_Pulley', 'Gearbox', 'Fan_Blower', 'Pumps', 'Compressor', 'Chillers', 'CNC', 'Other'])
    .withMessage('Invalid asset type'),

  body('locationId')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('parent_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Parent Asset ID format'),

  body('top_level')
    .optional()
    .isBoolean().withMessage('Top level must be a boolean'),

  body('top_level_asset_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid top-level asset ID format'),

  body('asset_timezone')
    .optional()
    .isString().withMessage('Timezone must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Timezone must not exceed 100 characters'),

  body('alarmType')
    .optional()
    .isArray({ max: 4 }).withMessage('Alarm type must be an array with at most four entries'),

  body('alarmType.*')
    .optional()
    .isIn(['alert', 'danger', 'critical', 'sendMail']).withMessage('Invalid alarm type'),

  body('userIdList')
    .isArray({ min: 1, max: 500 }).withMessage('Select between 1 and 500 users'),

  body('userIdList.*')
    .isMongoId().withMessage('Every selected user ID must be valid'),

  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  body('asset_id').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('asset_model').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('manufacturer').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('year').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('asset_build_type').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('asset_class').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('snoozeAlarm').optional().isBoolean().withMessage('Snooze alarm must be a boolean'),
  body('snoozeValue').optional().isFloat({ min: 0, max: 525600 }).withMessage('Snooze value must be between 0 and 525600'),
];
