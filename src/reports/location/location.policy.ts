import { sanitizeStructuredPayload } from '../../utils/structuredPayload';

const LOCATION_REPORT_MUTABLE_FIELDS = [
  'asset_condition_summary_data',
  'asset_fault_summary_data',
  'asset_report_data',
  'sub_location_data'
] as const;

export function sanitizeLocationReportUpdatePayload(input: unknown): Record<string, any> {
  const body = requirePlainObject(input, 'Location report payload');
  const result: Record<string, any> = {};
  for (const field of LOCATION_REPORT_MUTABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    if (!Array.isArray(body[field])) throw badRequest(`${field} must be an array`);
    result[field] = sanitizeStructuredPayload(body[field], field, {
      maxBytes: 1024 * 1024,
      maxDepth: 16,
      maxNodes: 20_000,
      maxStringLength: 50_000
    });
  }
  if (!Object.keys(result).length) throw badRequest('No supported location report fields were provided');
  return result;
}

function requirePlainObject(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw badRequest(`${label} must be an object`);
  }
  return value as Record<string, any>;
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}
