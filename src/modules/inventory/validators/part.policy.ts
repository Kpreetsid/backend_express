const PART_MUTABLE_FIELDS = [
  'part_name',
  'part_number',
  'barcode',
  'unit',
  'description',
  'part_type',
  'quantity',
  'min_quantity',
  'reorder_point',
  'cost',
  'preferred_vendor',
  'lead_time_days',
  'location_id',
  'currency'
] as const;

export type PartMutableField = typeof PART_MUTABLE_FIELDS[number];

/**
 * Copies only client-editable part fields. Tenant, visibility, ownership and
 * audit fields are always derived by the authenticated server-side workflow.
 */
export function sanitizePartPayload(source: unknown): Partial<Record<PartMutableField, any>> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {};
  }

  const input = source as Record<string, any>;
  return PART_MUTABLE_FIELDS.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      result[field] = input[field];
    }
    return result;
  }, {} as Partial<Record<PartMutableField, any>>);
}

/** General part edits exclude on-hand stock, which has its own audited API. */
export function sanitizePartMetadataUpdatePayload(source: unknown): Record<string, any> {
  const payload = sanitizePartPayload(source) as Record<string, any>;
  delete payload.quantity;
  return payload;
}
