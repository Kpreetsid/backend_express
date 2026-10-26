import { PROCEDURE_FIELD_TYPES, PROCEDURE_ITEM_TYPES } from '../models/procedure.model';

export function sanitizeProcedureContent(body: any): any {
  return {
    name: String(body?.name || '').trim(),
    category: String(body?.category || '').trim(),
    tags: normalizeStrings(body?.tags),
    location_ids: body?.location_ids,
    asset_ids: body?.asset_ids,
    description: String(body?.description || '').trim(),
    required_parts: body?.required_parts,
    steps: sanitizeProcedureItems(body?.steps),
    version_notes: String(body?.version_notes || '').trim()
  };
}

export function sanitizeProcedureItems(items: any): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((item: any) => {
    const type = PROCEDURE_ITEM_TYPES.includes(item?.type) ? item.type : 'heading';
    const base: any = {
      id: String(item?.id || '').trim(),
      type,
      title: String(item?.title || '').trim(),
      description: String(item?.description || '').trim()
    };

    if (item?.visibility_condition && typeof item.visibility_condition === 'object') {
      base.visibility_condition = {
        step_id: String(item.visibility_condition.step_id || '').trim(),
        values: normalizeStrings(item.visibility_condition.values)
      };
    }
    if (type === 'section') {
      base.items = sanitizeProcedureItems(item?.items);
    }
    if (type === 'field') {
      base.field_type = PROCEDURE_FIELD_TYPES.includes(item?.field_type) ? item.field_type : 'text';
      base.required = !!item?.required;
      base.include_time = !!item?.include_time;
      base.options = normalizeStrings(item?.options);
      base.scoring_enabled = !!item?.scoring_enabled;
      base.option_scores = Array.isArray(item?.option_scores)
        ? item.option_scores.map((score: any) => Number(score)).filter(Number.isFinite)
        : [];
      base.corrective_actions = Array.isArray(item?.corrective_actions)
        ? item.corrective_actions.map((action: any) => ({
            id: String(action?.id || '').trim(),
            title: String(action?.title || '').trim(),
            description: String(action?.description || '').trim(),
            priority: String(action?.priority || '').trim(),
            trigger_values: normalizeStrings(action?.trigger_values)
          }))
        : [];
    }
    return base;
  });
}

function normalizeStrings(values: any): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value: any) => String(value || '').trim()).filter(Boolean)));
}
