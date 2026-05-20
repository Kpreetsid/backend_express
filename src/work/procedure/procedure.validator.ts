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

    if (item.visibility_condition != null) {
      if (typeof item.visibility_condition !== 'object') {
        throw new Error(`${itemPath}.visibility_condition must be an object`);
      }

      if (item.visibility_condition.step_id != null && typeof item.visibility_condition.step_id !== 'string') {
        throw new Error(`${itemPath}.visibility_condition.step_id must be a string`);
      }

      if (item.visibility_condition.values != null) {
        if (!Array.isArray(item.visibility_condition.values) || item.visibility_condition.values.some((value: any) => typeof value !== 'string')) {
          throw new Error(`${itemPath}.visibility_condition.values must be an array of strings`);
        }
      }
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

      if (item.scoring_enabled != null && typeof item.scoring_enabled !== 'boolean') {
        throw new Error(`${itemPath}.scoring_enabled must be a boolean`);
      }

      if (item.option_scores != null) {
        if (!Array.isArray(item.option_scores) || item.option_scores.some((score: any) => typeof score !== 'number' || Number.isNaN(score))) {
          throw new Error(`${itemPath}.option_scores must be an array of numbers`);
        }
      }

      if (item.corrective_actions != null) {
        if (!Array.isArray(item.corrective_actions)) {
          throw new Error(`${itemPath}.corrective_actions must be an array`);
        }

        item.corrective_actions.forEach((action: any, actionIndex: number) => {
          const actionPath = `${itemPath}.corrective_actions[${actionIndex}]`;
          if (!action || typeof action !== 'object') {
            throw new Error(`${actionPath} must be an object`);
          }

          if (!action.id || typeof action.id !== 'string') {
            throw new Error(`${actionPath}.id is required`);
          }

          if (!action.title || typeof action.title !== 'string') {
            throw new Error(`${actionPath}.title is required`);
          }

          if (action.description != null && typeof action.description !== 'string') {
            throw new Error(`${actionPath}.description must be a string`);
          }

          if (action.priority != null && typeof action.priority !== 'string') {
            throw new Error(`${actionPath}.priority must be a string`);
          }

          if (action.trigger_values != null) {
            if (!Array.isArray(action.trigger_values) || action.trigger_values.some((value: any) => typeof value !== 'string')) {
              throw new Error(`${actionPath}.trigger_values must be an array of strings`);
            }
          }
        });
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

  body('location_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Location tags must be an array'),

  body('location_ids.*')
    .if(body('location_ids').exists())
    .isMongoId().withMessage('Each location tag must be a valid id'),

  body('asset_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Asset tags must be an array'),

  body('asset_ids.*')
    .if(body('asset_ids').exists())
    .isMongoId().withMessage('Each asset tag must be a valid id'),

  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Description must be a string')
    .trim(),

  body('version_notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Version notes must be a string')
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

  body('location_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Location tags must be an array'),

  body('location_ids.*')
    .if(body('location_ids').exists())
    .isMongoId().withMessage('Each location tag must be a valid id'),

  body('asset_ids')
    .optional({ nullable: true })
    .isArray().withMessage('Asset tags must be an array'),

  body('asset_ids.*')
    .if(body('asset_ids').exists())
    .isMongoId().withMessage('Each asset tag must be a valid id'),

  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Description must be a string')
    .trim(),

  body('version_notes')
    .optional({ nullable: true, checkFalsy: true })
    .isString().withMessage('Version notes must be a string')
    .trim(),

  body('steps')
    .optional({ nullable: true })
    .isArray().withMessage('Steps must be an array')
    .custom((value) => validateProcedureItems(value || []))
];
