import { body } from 'express-validator';

export const equipmentValidator = [
  body('Equipment')
    .optional()
    .isObject().withMessage('Equipment must be an object'),

  body('Motor')
    .optional()
    .isObject().withMessage('Motor must be an object'),

  body('Flexible')
    .optional()
    .isObject().withMessage('Flexible must be an object'),

  body('Belt_Pulley')
    .optional()
    .isArray().withMessage('Belt_Pulley must be an array'),

  body('Gearbox')
    .optional()
    .isArray().withMessage('Gearbox must be an array'),

  body('Fans_Blowers')
    .optional()
    .isObject().withMessage('Fans_Blowers must be an object'),

  body('Pumps')
    .optional()
    .isObject().withMessage('Pumps must be an object'),

  body('Compressor')
    .optional()
    .isObject().withMessage('Compressor must be an object')
];
