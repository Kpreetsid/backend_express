import { body } from 'express-validator';
import { sanitizeStructuredPayload } from '../../../common/utils/structured-payload.helper';

const INSPECTION_STATUSES = ['Open', 'In-Progress', 'On-Hold', 'Completed'];

export const inspectionValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim()
    .isLength({ max: 180 }).withMessage('Title must not exceed 180 characters'),

  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 4000 }).withMessage('Description must not exceed 4000 characters'),
  
  body('start_date')
    .notEmpty().withMessage('Start date is required')
    .isISO8601({ strict: true }).withMessage('Start date must be a valid ISO date'),

  body('form_id')
    .notEmpty().withMessage('Form ID is required')
    .isMongoId().withMessage('Invalid Form ID format'),

  body('location_id')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('asset_id')
    .notEmpty().withMessage('Asset ID is required')
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(INSPECTION_STATUSES).withMessage('Invalid inspection status'),

  body('month')
    .notEmpty().withMessage('Month is required')
    .isString().withMessage('Month must be a string')
    .trim()
    .isLength({ max: 32 }).withMessage('Month must not exceed 32 characters'),

  body('createdFrom')
    .notEmpty().withMessage('Created From is required')
    .isString().withMessage('Created From must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Created From must not exceed 100 characters'),

  body('assignedUser')
    .optional({ nullable: true })
    .isArray({ max: 100 }).withMessage('Assigned users must be an array with at most 100 entries'),

  body('assignedUser.*')
    .if(body('assignedUser').exists())
    .isMongoId().withMessage('Each assigned user must be a valid id'),

  body('no_of_actions')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 100000 }).withMessage('Number of actions must be a non-negative integer'),

  body('inspection_report')
    .optional({ nullable: true })
    .isObject().withMessage('Inspection report must be an object')
    .custom((value) => {
      sanitizeStructuredPayload(value, 'Inspection report');
      return true;
    })
];

export const updateInspectionValidator = [
  body('title').optional({ nullable: true }).isString().trim().notEmpty().isLength({ max: 180 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
  body('start_date').optional({ nullable: true }).isISO8601({ strict: true }).withMessage('Start date must be a valid ISO date'),
  body('form_id').optional({ nullable: true }).isMongoId().withMessage('Invalid Form ID format'),
  body('location_id').optional({ nullable: true }).isMongoId().withMessage('Invalid Location ID format'),
  body('asset_id').optional({ nullable: true }).isMongoId().withMessage('Invalid Asset ID format'),
  body('status').optional({ nullable: true }).isIn(INSPECTION_STATUSES).withMessage('Invalid inspection status'),
  body('month').optional({ nullable: true }).isString().trim().notEmpty().isLength({ max: 32 }),
  body('createdFrom').optional({ nullable: true }).isString().trim().notEmpty().isLength({ max: 100 }),
  body('assignedUser').optional({ nullable: true }).isArray({ max: 100 }),
  body('assignedUser.*').if(body('assignedUser').exists()).isMongoId().withMessage('Each assigned user must be a valid id'),
  body('no_of_actions').optional({ nullable: true }).isInt({ min: 0, max: 100000 }),
  body('inspection_report')
    .optional({ nullable: true })
    .isObject().withMessage('Inspection report must be an object')
    .custom((value) => {
      sanitizeStructuredPayload(value, 'Inspection report');
      return true;
    })
];
