const CREATE_FIELDS = [
  'title',
  'description',
  'estimated_time',
  'actual_start_date',
  'actual_end_date',
  'actual_time',
  'block_reason',
  'priority',
  'status',
  'type',
  'nature_of_work',
  'parentId',
  'wo_asset_id',
  'wo_location_id',
  'start_date',
  'end_date',
  'sop_form_id',
  'procedure_ids',
  'excluded_procedure_part_ids',
  'procedure_entries',
  'sop_form_submitted',
  'sop_form_data',
  'parts',
  'tasks',
  'labor_entries',
  'files',
  'userIdList',
  'work_request_id',
  'asset_report_id',
  'createdFrom'
] as const;

const UPDATE_FIELDS = CREATE_FIELDS.filter(field => ![
  'parentId',
  'work_request_id',
  'asset_report_id',
  'createdFrom'
].includes(field));

export type WorkOrderPayloadMode = 'create' | 'update';

/**
 * Keeps tenant, audit, hierarchy linkage, request conversion, scheduler and
 * completion-governance fields under server ownership.
 */
export const sanitizeWorkOrderPayload = (input: any, mode: WorkOrderPayloadMode): Record<string, any> => {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const allowedFields: readonly string[] = mode === 'create' ? CREATE_FIELDS : UPDATE_FIELDS;
  return allowedFields.reduce((result: Record<string, any>, field: string) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) result[field] = source[field];
    return result;
  }, {});
};
