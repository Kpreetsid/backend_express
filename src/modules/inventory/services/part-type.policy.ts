const PART_TYPE_MUTABLE_FIELDS = ['name', 'description'] as const;

export function sanitizePartTypePayload(source: unknown): Record<string, any> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {};
  }

  const input = source as Record<string, any>;
  return PART_TYPE_MUTABLE_FIELDS.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      result[field] = input[field];
    }
    return result;
  }, {} as Record<string, any>);
}

