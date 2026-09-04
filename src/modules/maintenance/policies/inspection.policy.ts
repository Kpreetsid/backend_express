import { sanitizeStructuredPayload } from '../../../common/utils/structured-payload.helper';

export function sanitizeInspectionPayload(body: any): any {
  return {
    title: String(body?.title || '').trim(),
    description: String(body?.description || '').trim(),
    start_date: String(body?.start_date || '').trim(),
    form_id: body?.form_id,
    inspection_report: sanitizeStructuredPayload(body?.inspection_report || {}, 'Inspection report'),
    location_id: body?.location_id,
    asset_id: body?.asset_id,
    assignedUser: normalizeIds(body?.assignedUser),
    status: String(body?.status || '').trim(),
    month: String(body?.month || '').trim(),
    createdFrom: String(body?.createdFrom || '').trim(),
    no_of_actions: Number(body?.no_of_actions || 0)
  };
}

function normalizeIds(values: any): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value: any) => String(value || '').trim()).filter(Boolean)));
}
