import { sanitizeStructuredPayload } from '../../../common/utils/structured-payload.helper';

export function sanitizeSopPayload(body: any): any {
  return {
    name: String(body?.name || '').trim(),
    description: String(body?.description || '').trim(),
    locationId: body?.locationId,
    categoryId: body?.categoryId,
    json_temp: sanitizeStructuredPayload(body?.json_temp || { components: [] }, 'Form template')
  };
}
