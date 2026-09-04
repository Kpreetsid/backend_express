const MUTABLE_WORK_REQUEST_FIELDS = [
  'title',
  'description',
  'problemType',
  'priority',
  'location_id',
  'asset_id',
  'files',
  'tags',
  'remarks'
] as const;

export const sanitizeWorkRequestPayload = (body: any): Record<string, any> => {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const sanitized: Record<string, any> = {};

  for (const field of MUTABLE_WORK_REQUEST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      sanitized[field] = source[field];
    }
  }

  return sanitized;
};
