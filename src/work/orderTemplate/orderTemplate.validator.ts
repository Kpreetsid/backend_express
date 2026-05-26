import { body } from 'express-validator';
import { WORK_ORDER_PRIORITIES } from '../../models/workOrder.model';
import { WORK_ORDER_TEMPLATE_MAINTENANCE_TYPES, WORK_ORDER_TEMPLATE_TIME_UNITS } from '../../models/workOrderTemplate.model';

const optionalTimeUnit = [...WORK_ORDER_TEMPLATE_TIME_UNITS];

export const orderTemplateValidator = [
  body('template_name')
    .notEmpty().withMessage('Template name is required')
    .isString().withMessage('Template name must be a string')
    .trim(),

  body('title')
    .notEmpty().withMessage('Work order title is required')
    .isString().withMessage('Work order title must be a string')
    .trim(),

  body('priority')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(WORK_ORDER_PRIORITIES)
    .withMessage('Invalid priority level'),

  body('nature_of_work')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Nature of work must be a string')
    .trim(),

  body('maintenance_type')
    .optional({ nullable: true, checkFalsy: true })
    .isIn([...WORK_ORDER_TEMPLATE_MAINTENANCE_TYPES])
    .withMessage('Invalid maintenance type'),

  body('estimated_time')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Estimated time must be a number'),

  body('procedure_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Procedure IDs must be an array'),
  body('procedure_ids.*')
    .optional()
    .isMongoId().withMessage('Invalid procedure ID'),

  body('assignee_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Assignee IDs must be an array'),
  body('assignee_ids.*')
    .optional()
    .isMongoId().withMessage('Invalid assignee ID'),

  body('location_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Location IDs must be an array'),
  body('location_ids.*')
    .optional()
    .isMongoId().withMessage('Invalid location ID'),

  body('asset_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Asset IDs must be an array'),
  body('asset_ids.*')
    .optional()
    .isMongoId().withMessage('Invalid asset ID'),

  body('parts')
    .optional({ nullable: true })
    .isArray().withMessage('Parts must be an array'),
  body('parts.*.part_id')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId().withMessage('Invalid part ID'),
  body('parts.*.part_name')
    .if(body('parts').exists())
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Part name must be a string'),
  body('parts.*.quantity')
    .if(body('parts').exists())
    .isNumeric().withMessage('Part quantity must be numeric'),

  body('categories')
    .optional({ nullable: true })
    .isArray().withMessage('Categories must be an array'),
  body('categories.*')
    .optional()
    .isString().withMessage('Category must be a string'),

  body('vendors')
    .optional({ nullable: true })
    .isArray().withMessage('Vendors must be an array'),
  body('vendors.*')
    .optional()
    .isString().withMessage('Vendor must be a string'),

  body('due_date_settings.due_after_value')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Due-after value must be numeric'),
  body('due_date_settings.due_after_unit')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(optionalTimeUnit).withMessage('Invalid due-after unit'),
  body('due_date_settings.start_before_value')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Start-before value must be numeric'),
  body('due_date_settings.start_before_unit')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(optionalTimeUnit).withMessage('Invalid start-before unit'),
  body('due_date_settings.recurrence_value')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Recurrence value must be numeric'),
  body('due_date_settings.recurrence_unit')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(optionalTimeUnit).withMessage('Invalid recurrence unit')
];

export const updateOrderTemplateValidator = orderTemplateValidator;
