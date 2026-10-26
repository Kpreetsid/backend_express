const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export interface StructuredPayloadLimits {
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxStringLength?: number;
}

/**
 * Validate and clone user-authored JSON before it is stored in a Mixed/Object
 * field. This prevents prototype-pollution keys and puts a hard ceiling on
 * schemas/reports that would otherwise consume unbounded memory.
 */
export function sanitizeStructuredPayload<T>(
  value: T,
  fieldName: string,
  limits: StructuredPayloadLimits = {}
): T {
  const maxBytes = limits.maxBytes ?? 512 * 1024;
  const maxDepth = limits.maxDepth ?? 24;
  const maxNodes = limits.maxNodes ?? 5000;
  const maxStringLength = limits.maxStringLength ?? 100_000;
  let nodes = 0;

  const visit = (current: any, depth: number): void => {
    nodes += 1;
    if (nodes > maxNodes) {
      throw badRequest(`${fieldName} is too complex`);
    }
    if (depth > maxDepth) {
      throw badRequest(`${fieldName} exceeds the maximum nesting depth`);
    }
    if (current == null || typeof current === 'boolean') return;
    if (typeof current === 'string') {
      if (current.length > maxStringLength) {
        throw badRequest(`${fieldName} contains an oversized text value`);
      }
      return;
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) {
        throw badRequest(`${fieldName} contains an invalid number`);
      }
      return;
    }
    if (typeof current !== 'object') {
      throw badRequest(`${fieldName} contains an unsupported value`);
    }

    for (const [key, child] of Object.entries(current)) {
      if (UNSAFE_OBJECT_KEYS.has(key)) {
        throw badRequest(`${fieldName} contains an unsafe key`);
      }
      visit(child, depth + 1);
    }
  };

  visit(value, 0);
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw badRequest(`${fieldName} must be valid JSON`);
  }
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw badRequest(`${fieldName} exceeds the maximum allowed size`);
  }
  return JSON.parse(serialized) as T;
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}
