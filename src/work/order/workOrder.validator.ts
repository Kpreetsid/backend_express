import { body } from 'express-validator';

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
    .isIn(['Open', 'Pending', 'On-Hold', 'In-Progress', 'Approved', 'Rejected', 'Completed'])
    .withMessage('Invalid status'),

  body('wo_asset_id')
    .optional({ nullable: true })
    .isMongoId().withMessage('Invalid Asset ID format'),

  body('wo_location_id')
    .notEmpty().withMessage('Location ID is required')
    .isMongoId().withMessage('Invalid Location ID format'),

  body('estimated_time')
    .optional({ nullable: true })
    .isNumeric().withMessage('Estimated time must be a number'),

  body('tasks')
    .optional()
    .isArray().withMessage('Tasks must be an array'),

  body('tasks.*.title')
    .if(body('tasks').exists())
    .notEmpty().withMessage('Task title is required'),

  body('parts')
    .optional()
    .isArray().withMessage('Parts must be an array'),

  body('parts.*.part_id')
    .if(body('parts').exists())
    .notEmpty().withMessage('Part ID is required')
    .isMongoId().withMessage('Invalid Part ID format')
];

export const updateWorkOrderValidator = workOrderValidator.map(v => {
  // Clone and make optional for updates
  return v.optional();
});
