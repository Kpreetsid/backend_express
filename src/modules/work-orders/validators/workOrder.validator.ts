import { body } from 'express-validator';

const commonWorkOrderFields = [
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
    .isArray().withMessage('Tasks must be an array'),

  body('tasks.*.title')
    .if(body('tasks').exists())
    .notEmpty().withMessage('Task title is required'),

  body('parts')
    .optional({ nullable: true })
    .isArray().withMessage('Parts must be an array'),

  body('parts.*.part_id')
    .if(body('parts').exists())
    .notEmpty().withMessage('Part ID is required')
    .isMongoId().withMessage('Invalid Part ID format'),

  body('labor_entries')
    .optional({ nullable: true })
    .isArray().withMessage('Labor entries must be an array'),

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

  ...commonWorkOrderFields
];
