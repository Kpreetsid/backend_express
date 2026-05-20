import { body } from 'express-validator';

export const partValidator = [
  body('part_name')
    .notEmpty().withMessage('Part name is required')
    .isString().withMessage('Part name must be a string')
    .trim(),
  
  body('part_number')
    .notEmpty().withMessage('Part number is required')
    .isString().withMessage('Part number must be a string')
    .trim(),

  body('barcode')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Barcode must be a string')
    .trim(),

  body('unit')
    .notEmpty().withMessage('Unit is required')
    .isString().withMessage('Unit must be a string')
    .trim(),

  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isNumeric().withMessage('Quantity must be a number'),

  body('min_quantity')
    .notEmpty().withMessage('Minimum quantity is required')
    .isNumeric().withMessage('Minimum quantity must be a number'),

  body('reorder_point')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Reorder point must be a number'),

  body('cost')
    .notEmpty().withMessage('Cost is required')
    .isNumeric().withMessage('Cost must be a number'),

  body('preferred_vendor')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Preferred vendor must be a string')
    .trim(),

  body('lead_time_days')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Lead time days must be a number'),

  body('location_id')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('currency')
    .optional()
    .isString().withMessage('Currency must be a string')
    .trim()
];
