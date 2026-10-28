import { body } from 'express-validator';

export const inspectionValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim(),
  
  body('start_date')
    .notEmpty().withMessage('Start date is required')
    .isString().withMessage('Start date must be a string')
    .trim(),

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
    .isString().withMessage('Status must be a string')
    .trim(),

  body('month')
    .notEmpty().withMessage('Month is required')
    .isString().withMessage('Month must be a string')
    .trim(),

  body('createdFrom')
    .notEmpty().withMessage('Created From is required')
    .isString().withMessage('Created From must be a string')
    .trim()
];


export const inspectionCorrectiveWorkOrderValidator = [
  body('finding_key')
    .notEmpty().withMessage('Finding key is required')
    .isString().withMessage('Finding key must be a string')
    .trim()
    .isLength({ max: 160 }).withMessage('Finding key must be 160 characters or fewer'),
  body('title')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Title must be a string')
    .trim()
    .isLength({ max: 255 }).withMessage('Title must be 255 characters or fewer'),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('Description must be a string'),
  body('priority')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['None', 'Low', 'Medium', 'High', 'Urgent']).withMessage('Invalid priority'),
  body('start_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Start date must be a valid date'),
  body('end_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('End date must be a valid date'),
  body('estimated_time')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Estimated time must be zero or greater'),
  body('userIdList')
    .optional({ nullable: true })
    .isArray().withMessage('Assigned users must be an array'),
  body('userIdList.*')
    .if(body('userIdList').exists())
    .isMongoId().withMessage('Invalid assigned user ID'),
  body('procedure_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Procedure IDs must be an array'),
  body('procedure_ids.*')
    .if(body('procedure_ids').exists())
    .isMongoId().withMessage('Invalid procedure ID'),
  body('parts')
    .optional({ nullable: true })
    .isArray().withMessage('Parts must be an array'),
  body('parts.*.part_id')
    .if(body('parts').exists())
    .isMongoId().withMessage('Invalid part ID')
];
