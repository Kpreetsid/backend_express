import { body, query } from 'express-validator';
import { CYCLE_COUNT_STATUSES } from '../../models/cycleCount.model';

export const cycleCountQueryValidator = [
  query('status')
    .optional()
    .custom((value) => String(value).split(',').every((status) => CYCLE_COUNT_STATUSES.includes(status.trim() as any)))
    .withMessage('Invalid cycle count status'),
  query('part_id').optional().isString().isLength({ max: 500 }),
  query('location_id').optional().isString().isLength({ max: 500 })
];

export const createCycleCountValidator = [
  body('part_id')
    .notEmpty().withMessage('Part ID is required')
    .isMongoId().withMessage('Invalid part ID format'),
  body('counted_quantity')
    .notEmpty().withMessage('Counted quantity is required')
    .custom((value) => {
      const quantity = Number(value);
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new Error('Counted quantity must be a finite number greater than or equal to zero');
      }
      return true;
    }),
  body('reason')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Reason must be a string')
    .trim()
    .isLength({ max: 500 }).withMessage('Reason must not exceed 500 characters')
];

export const approveCycleCountValidator = [
  body('decision')
    .notEmpty().withMessage('Decision is required')
    .isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
  body('approval_notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Approval notes must be a string')
    .trim()
    .isLength({ max: 500 }).withMessage('Approval notes must not exceed 500 characters')
];
