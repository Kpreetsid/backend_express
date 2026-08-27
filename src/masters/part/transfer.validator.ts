import { body } from 'express-validator';

/**
 * Validation rules for the dedicated stock-transfer endpoint.
 * POST /api/master/parts/:id/transfer
 *
 * Expects:
 *   { destination_part_id: string, quantity: number, note: string }
 *
 * - destination_part_id: required MongoId of the destination part document.
 * - quantity: required, must be a positive number.
 * - note: required, non-empty string — audit trail requires a reason.
 */
export const transferValidator = [
  body('destination_part_id')
    .notEmpty().withMessage('Destination part ID is required')
    .isMongoId().withMessage('Invalid destination part ID format'),

  body('quantity')
    .notEmpty().withMessage('Transfer quantity is required')
    .isNumeric().withMessage('Quantity must be a number')
    .custom((value) => {
      if (Number(value) <= 0) {
        throw new Error('Transfer quantity must be greater than zero');
      }
      return true;
    }),

  body('note')
    .notEmpty().withMessage('A reason / note is required for stock transfers')
    .isString().withMessage('Note must be a string')
    .trim()
    .isLength({ min: 3, max: 500 }).withMessage('Note must be between 3 and 500 characters')
];
