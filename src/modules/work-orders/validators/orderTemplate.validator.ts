import { body, ValidationChain } from 'express-validator';
import { WORK_ORDER_PRIORITIES } from '../models/workOrder.model';
import { WORK_ORDER_TEMPLATE_MAINTENANCE_TYPES, WORK_ORDER_TEMPLATE_TIME_UNITS } from '../models/workOrderTemplate.model';

function templateRules(requireCoreFields: boolean): ValidationChain[] {
  const coreString = (field: string, label: string) => {
    const chain = body(field);
    if (requireCoreFields) chain.notEmpty().withMessage(`${label} is required`);
    else chain.optional({ nullable: true });
    return chain
      .isString().withMessage(`${label} must be a string`)
      .trim()
      .isLength({ max: 180 }).withMessage(`${label} must not exceed 180 characters`);
  };

  return [
    coreString('template_name', 'Template name'),
    coreString('title', 'Work order title'),
    body('description').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
    body('priority').optional({ nullable: true, checkFalsy: true }).isIn(WORK_ORDER_PRIORITIES).withMessage('Invalid priority level'),
    body('nature_of_work').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 120 }),
    body('maintenance_type').optional({ nullable: true, checkFalsy: true }).isIn([...WORK_ORDER_TEMPLATE_MAINTENANCE_TYPES]).withMessage('Invalid maintenance type'),
    body('estimated_time').optional({ nullable: true }).isFloat({ min: 0, max: 1000000 }).withMessage('Estimated time must be a non-negative number'),

    body('procedure_ids').optional({ nullable: true }).isArray({ max: 100 }).withMessage('Procedure IDs must contain at most 100 entries'),
    body('procedure_ids.*').if(body('procedure_ids').exists()).isMongoId().withMessage('Invalid procedure ID'),
    body('assignee_ids').optional({ nullable: true }).isArray({ max: 100 }).withMessage('Assignee IDs must contain at most 100 entries'),
    body('assignee_ids.*').if(body('assignee_ids').exists()).isMongoId().withMessage('Invalid assignee ID'),
    body('location_ids').optional({ nullable: true }).isArray({ max: 100 }).withMessage('Location IDs must contain at most 100 entries'),
    body('location_ids.*').if(body('location_ids').exists()).isMongoId().withMessage('Invalid location ID'),
    body('asset_ids').optional({ nullable: true }).isArray({ max: 200 }).withMessage('Asset IDs must contain at most 200 entries'),
    body('asset_ids.*').if(body('asset_ids').exists()).isMongoId().withMessage('Invalid asset ID'),

    body('parts').optional({ nullable: true }).isArray({ max: 200 }).withMessage('Parts must contain at most 200 entries'),
    body('parts.*.part_id').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Invalid part ID'),
    body('parts.*.part_name').if(body('parts').exists()).isString().trim().notEmpty().isLength({ max: 180 }),
    body('parts.*.part_number').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
    body('parts.*.quantity').if(body('parts').exists()).isFloat({ gt: 0, max: 1000000 }).withMessage('Part quantity must be greater than zero'),
    body('parts.*.unit').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('parts.*.cost').optional({ nullable: true }).isFloat({ min: 0, max: 1000000000000 }).withMessage('Part cost must be non-negative'),
    body('parts.*.currency').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ min: 3, max: 3 }).withMessage('Currency must use a 3-letter code'),
    body('parts.*.procedureNames').optional({ nullable: true }).isArray({ max: 100 }),
    body('parts.*.procedureNames.*').if(body('parts.*.procedureNames').exists()).isString().trim().isLength({ max: 180 }),

    body('categories').optional({ nullable: true }).isArray({ max: 50 }).withMessage('Categories must contain at most 50 entries'),
    body('categories.*').if(body('categories').exists()).isString().trim().isLength({ max: 120 }),
    body('vendors').optional({ nullable: true }).isArray({ max: 50 }).withMessage('Vendors must contain at most 50 entries'),
    body('vendors.*').if(body('vendors').exists()).isString().trim().isLength({ max: 180 }),
    body('field_rules').optional({ nullable: true }).isObject().withMessage('Field rules must be an object'),

    ...['due_after_value', 'start_before_value', 'recurrence_value'].map((field) =>
      body(`due_date_settings.${field}`).optional({ nullable: true }).isFloat({ min: 0, max: 1000000 }).withMessage(`${field} must be non-negative`)
    ),
    ...['due_after_unit', 'start_before_unit', 'recurrence_unit'].map((field) =>
      body(`due_date_settings.${field}`).optional({ nullable: true, checkFalsy: true }).isIn([...WORK_ORDER_TEMPLATE_TIME_UNITS]).withMessage(`Invalid ${field}`)
    )
  ];
}

export const orderTemplateValidator = templateRules(true);
export const updateOrderTemplateValidator = templateRules(false);
