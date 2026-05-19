import { body } from 'express-validator';
import { PROCEDURE_FIELD_TYPES, PROCEDURE_ITEM_TYPES } from '../../models/procedure.model';

function validateProcedureItems(items: any[], path: string = 'steps'): true {
  if (!Array.isArray(items)) {
    throw new Error(`${path} must be an array`);
  }

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!item || typeof item !== 'object') {
      throw new Error(`${itemPath} must be an object`);
    }

    if (!item.id || typeof item.id !== 'string') {
      throw new Error(`${itemPath}.id is required`);
    }

    if (!PROCEDURE_ITEM_TYPES.includes(item.type)) {
      throw new Error(`${itemPath}.type is invalid`);
    }

    if (!item.title || typeof item.title !== 'string') {
      throw new Error(`${itemPath}.title is required`);
    }

    if (item.description != null && typeof item.description !== 'string') {
      throw new Error(`${itemPath}.description must be a string`);
    }

    if (item.type === 'field') {
      if (!PROCEDURE_FIELD_TYPES.includes(item.field_type)) {
        throw new Error(`${itemPath}.field_type is invalid`);
      }

      if (item.required != null && typeof item.required !== 'boolean') {
        throw new Error(`${itemPath}.required must be a boolean`);
      }

      if (item.include_time != null && typeof item.include_time !== 'boolean') {
        throw new Error(`${itemPath}.include_time must be a boolean`);
      }

      if (item.options != null) {
        if (!Array.isArray(item.options) || item.options.some((option: any) => typeof option !== 'string')) {
          throw new Error(`${itemPath}.options must be an array of strings`);
        }
      }
    }

    if (item.type === 'section') {
      validateProcedureItems(item.items || [], `${itemPath}.items`);
    }
  });

  return true;
}

export const procedureValidator = [
  body('name')
    .notEmpty().withMessage('Procedure name is required')
    .isString().withMessage('Procedure name must be a string')
    .trim(),

  body('category')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Category must be a string')
    .trim(),

  body('tags')
    .optional({ nullable: true })
    .isArray().withMessage('Tags must be an array'),

  body('tags.*')
    .if(body('tags').exists())
    .isString().withMessage('Each tag must be a string')
    .trim(),

  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Description must be a string')
    .trim(),

  body('steps')
    .optional({ nullable: true })
    .isArray().withMessage('Steps must be an array')
    .custom((value) => validateProcedureItems(value || []))
];

export const updateProcedureValidator = [
  body('name')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Procedure name must be a string')
    .trim(),

  body('category')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Category must be a string')
    .trim(),

  body('tags')
    .optional({ nullable: true })
    .isArray().withMessage('Tags must be an array'),

  body('tags.*')
    .if(body('tags').exists())
    .isString().withMessage('Each tag must be a string')
    .trim(),

  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Description must be a string')
    .trim(),

  body('steps')
    .optional({ nullable: true })
    .isArray().withMessage('Steps must be an array')
    .custom((value) => validateProcedureItems(value || []))
];
