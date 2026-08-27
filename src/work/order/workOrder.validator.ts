import { body } from 'express-validator';
import { WORK_ORDER_STATUSES } from '../../models/workOrder.model';

export const workOrderStatusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(WORK_ORDER_STATUSES).withMessage('Invalid status'),
  body('block_reason')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Block reason must be a string')
    .isLength({ max: 2000 }).withMessage('Block reason cannot exceed 2000 characters')
    .trim()
];

<<<<<<< Updated upstream
const commonWorkOrderFields = [
=======
export const workOrderValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters')
    .trim(),

  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .isLength({ max: 10000 }).withMessage('Description cannot exceed 10000 characters')
    .trim(),
  
  body('priority')
    .notEmpty().withMessage('Priority is required')
    .isIn(['None', 'Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Invalid priority level'),

  body('status')
    .optional()
    .isIn(['Open', 'Pending', 'Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'])
    .withMessage('Invalid status'),

  body('wo_asset_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('wo_location_id')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('work_request_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid work request ID format'),

>>>>>>> Stashed changes
  body('estimated_time')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Estimated time must be a number'),

  body('actual_start_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Actual start date must be a valid date'),

  body('actual_end_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Actual end date must be a valid date'),

  body('actual_time')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Actual time must be a number'),

  body('block_reason')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Block reason must be a string')
    .trim(),

  body('procedure_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Procedure IDs must be an array'),

  body('procedure_ids.*')
    .if(body('procedure_ids').exists())
    .notEmpty().withMessage('Procedure ID is required')
    .isMongoId().withMessage('Invalid Procedure ID format'),

  body('excluded_procedure_part_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Excluded procedure part IDs must be an array'),

  body('excluded_procedure_part_ids.*')
    .if(body('excluded_procedure_part_ids').exists())
    .notEmpty().withMessage('Excluded procedure part ID is required')
    .isMongoId().withMessage('Invalid excluded procedure part ID format'),

  body('procedure_entries')
    .optional({ nullable: true })
    .isArray().withMessage('Procedure entries must be an array'),

  body('procedure_entries.*.procedure_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid procedure entry ID format'),

  body('tasks')
<<<<<<< Updated upstream
    .optional({ nullable: true })
    .isArray().withMessage('Tasks must be an array'),
=======
    .optional()
    .isArray({ max: 200 }).withMessage('Tasks must be an array with at most 200 entries'),
>>>>>>> Stashed changes

  body('tasks.*.title')
    .if(body('tasks').exists())
    .notEmpty().withMessage('Task title is required'),

  body('parts')
<<<<<<< Updated upstream
    .optional({ nullable: true })
    .isArray().withMessage('Parts must be an array'),
=======
    .optional()
    .isArray({ max: 200 }).withMessage('Parts must be an array with at most 200 entries'),
>>>>>>> Stashed changes

  body('parts.*.part_id')
    .if(body('parts').exists())
    .notEmpty().withMessage('Part ID is required')
    .isMongoId().withMessage('Invalid Part ID format'),

  body('labor_entries')
<<<<<<< Updated upstream
    .optional({ nullable: true })
    .isArray().withMessage('Labor entries must be an array'),
=======
    .optional()
    .isArray({ max: 200 }).withMessage('Labor entries must be an array with at most 200 entries'),
>>>>>>> Stashed changes

  body('labor_entries.*.user_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid labor user ID format'),

  body('labor_entries.*.work_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Labor work date must be a valid date'),

  body('labor_entries.*.vendor_name')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Vendor name must be a string')
    .trim(),

  body('labor_entries.*.hours')
    .if(body('labor_entries').exists())
    .isNumeric().withMessage('Labor hours must be a number'),

  body('labor_entries.*.notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Labor notes must be a string')
    .trim()
];

export const workOrderValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('priority')
    .notEmpty().withMessage('Priority is required')
    .isIn(['None', 'Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Invalid priority level'),

  body('status')
    .optional()
    .isIn(['Open', 'Pending', 'Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'])
    .withMessage('Invalid status'),

  body('wo_asset_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('wo_location_id')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  ...commonWorkOrderFields
];

export const updateWorkOrderValidator = [
  body('title')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Title must be a string')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters')
    .trim(),

  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string')
    .isLength({ max: 10000 }).withMessage('Description cannot exceed 10000 characters')
    .trim(),

  body('priority')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['None', 'Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Invalid priority level'),

  body('status')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['Open', 'Pending', 'Blocked', 'Waiting-on-Parts', 'Waiting-on-Permit', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'])
    .withMessage('Invalid status'),

  body('wo_asset_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('wo_location_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid Location ID format'),

<<<<<<< Updated upstream
  ...commonWorkOrderFields
=======
  body('estimated_time')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Estimated time must be a number'),

  body('actual_start_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Actual start date must be a valid date'),

  body('actual_end_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Actual end date must be a valid date'),

  body('actual_time')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Actual time must be a number'),

  body('block_reason')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Block reason must be a string')
    .trim(),

  body('procedure_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Procedure IDs must be an array'),

  body('procedure_ids.*')
    .if(body('procedure_ids').exists())
    .notEmpty().withMessage('Procedure ID is required')
    .isMongoId().withMessage('Invalid Procedure ID format'),

  body('excluded_procedure_part_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Excluded procedure part IDs must be an array'),

  body('excluded_procedure_part_ids.*')
    .if(body('excluded_procedure_part_ids').exists())
    .notEmpty().withMessage('Excluded procedure part ID is required')
    .isMongoId().withMessage('Invalid excluded procedure part ID format'),

  body('procedure_entries')
    .optional({ nullable: true })
    .isArray().withMessage('Procedure entries must be an array'),

  body('procedure_entries.*.procedure_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid procedure entry ID format'),

  body('tasks')
    .optional({ nullable: true })
    .isArray({ max: 200 }).withMessage('Tasks must be an array with at most 200 entries'),

  body('tasks.*.title')
    .if(body('tasks').exists())
    .notEmpty().withMessage('Task title is required'),

  body('parts')
    .optional({ nullable: true })
    .isArray({ max: 200 }).withMessage('Parts must be an array with at most 200 entries'),

  body('parts.*.part_id')
    .if(body('parts').exists())
    .notEmpty().withMessage('Part ID is required')
    .isMongoId().withMessage('Invalid Part ID format'),

  body('labor_entries')
    .optional({ nullable: true })
    .isArray({ max: 200 }).withMessage('Labor entries must be an array with at most 200 entries'),

  body('labor_entries.*.user_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid labor user ID format'),

  body('labor_entries.*.work_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Labor work date must be a valid date'),

  body('labor_entries.*.vendor_name')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Vendor name must be a string')
    .trim(),

  body('labor_entries.*.hours')
    .if(body('labor_entries').exists())
    .isNumeric().withMessage('Labor hours must be a number'),

  body('labor_entries.*.notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Labor notes must be a string')
    .trim()
>>>>>>> Stashed changes
];
