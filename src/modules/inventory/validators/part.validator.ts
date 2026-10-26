import { body } from 'express-validator';

const finiteNonNegative = (label: string) => (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label} must be a finite number greater than or equal to zero`);
  }
  return true;
};

export const partValidator = [
  body('part_name')
    .notEmpty().withMessage('Part name is required')
    .isString().withMessage('Part name must be a string')
    .trim()
    .isLength({ max: 160 }).withMessage('Part name must not exceed 160 characters'),
  
  body('part_number')
    .notEmpty().withMessage('Part number is required')
    .isString().withMessage('Part number must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Part number must not exceed 100 characters'),

  body('barcode')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Barcode must be a string')
    .trim()
    .isLength({ max: 120 }).withMessage('Barcode must not exceed 120 characters'),

  body('unit')
    .notEmpty().withMessage('Unit is required')
    .isString().withMessage('Unit must be a string')
    .trim()
    .isLength({ max: 80 }).withMessage('Unit must not exceed 80 characters'),

  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .isLength({ max: 5000 }).withMessage('Description must not exceed 5000 characters'),

  body('part_type')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid part type ID format'),

  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .custom(finiteNonNegative('Quantity')),

  body('min_quantity')
    .notEmpty().withMessage('Minimum quantity is required')
    .custom(finiteNonNegative('Minimum quantity')),

  body('reorder_point')
    .optional({ nullable: true, checkFalsy: true })
    .custom(finiteNonNegative('Reorder point')),

  body('cost')
    .notEmpty().withMessage('Cost is required')
    .custom(finiteNonNegative('Cost')),

  body('preferred_vendor')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Preferred vendor must be a string')
    .trim()
    .isLength({ max: 160 }).withMessage('Preferred vendor must not exceed 160 characters'),

  body('lead_time_days')
    .optional({ nullable: true, checkFalsy: true })
    .custom(finiteNonNegative('Lead time days')),

  body('location_id')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('currency')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Currency must be a string')
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code')
    .matches(/^[A-Za-z]{3}$/).withMessage('Currency must contain letters only')
];
