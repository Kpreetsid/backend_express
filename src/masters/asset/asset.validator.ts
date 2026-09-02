import { body } from 'express-validator';

export const assetValidator = [
  body('asset_name')
    .notEmpty().withMessage('Asset name is required')
    .isString().withMessage('Asset name must be a string')
    .trim(),

  body('asset_type')
    .notEmpty().withMessage('Asset type is required')
    .isIn(['Equipment', 'Motor', 'Flexible', 'Rigid', 'Belt_Pulley', 'Gearbox', 'Fan_Blower', 'Pumps', 'Compressor', 'Chillers', 'CNC', 'Other', 'Extruder', 'Mixer', 'Agitator', 'Kiln', 'Rotary_Dryer'])
    .withMessage('Invalid asset type'),

  body('locationId')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('parent_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Parent Asset ID format'),

  body('asset_timezone')
    .optional()
    .isString().withMessage('Timezone must be a string'),

  body('alarmType')
    .optional()
    .isArray().withMessage('Alarm type must be an array')
];