const invalidPermissionPayload = (): Error & { status: number } =>
  Object.assign(new Error('Permission data contains an unknown key or non-boolean value'), { status: 400 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Apply only boolean changes to keys that already exist in the stored permission
 * document. This prevents a client from adding new privilege namespaces or
 * replacing the complete role record with arbitrary fields.
 */
export const sanitizePermissionPatch = (
  currentValue: unknown,
  requestedValue: unknown
): Record<string, Record<string, boolean>> => {
  if (!isRecord(currentValue) || !isRecord(requestedValue)) {
    throw invalidPermissionPayload();
  }

  const sanitized: Record<string, Record<string, boolean>> = {};
  for (const [sectionKey, sectionValue] of Object.entries(currentValue)) {
    if (!isRecord(sectionValue)) {
      continue;
    }
    sanitized[sectionKey] = {};
    for (const [permissionKey, permissionValue] of Object.entries(sectionValue)) {
      if (typeof permissionValue === 'boolean') {
        sanitized[sectionKey][permissionKey] = permissionValue;
      }
    }
  }

  let suppliedPermissionCount = 0;
  for (const [sectionKey, requestedSection] of Object.entries(requestedValue)) {
    const currentSection = currentValue[sectionKey];
    if (!isRecord(currentSection) || !isRecord(requestedSection)) {
      throw invalidPermissionPayload();
    }

    for (const [permissionKey, permissionValue] of Object.entries(requestedSection)) {
      if (!Object.prototype.hasOwnProperty.call(currentSection, permissionKey)
        || typeof currentSection[permissionKey] !== 'boolean'
        || typeof permissionValue !== 'boolean') {
        throw invalidPermissionPayload();
      }
      sanitized[sectionKey][permissionKey] = permissionValue;
      suppliedPermissionCount += 1;
    }
  }

  if (suppliedPermissionCount === 0) {
    throw Object.assign(new Error('At least one permission value is required'), { status: 400 });
  }

  return sanitized;
};
