export const DIAGNOSTIC_LIFECYCLES = [
  'ACTIVE',
  'MONITORING',
  'RESOLVED',
  'SUPERSEDED',
  'HISTORICAL',
] as const;

export type DiagnosticLifecycle = typeof DIAGNOSTIC_LIFECYCLES[number];

const CURRENT_LIFECYCLES = new Set<DiagnosticLifecycle>(['ACTIVE', 'MONITORING']);
const ALLOWED_TRANSITIONS: Readonly<Record<DiagnosticLifecycle, ReadonlySet<DiagnosticLifecycle>>> = {
  ACTIVE: new Set(['ACTIVE', 'MONITORING', 'RESOLVED', 'SUPERSEDED']),
  MONITORING: new Set(['ACTIVE', 'MONITORING', 'RESOLVED', 'SUPERSEDED']),
  RESOLVED: new Set(['RESOLVED', 'ACTIVE', 'MONITORING', 'HISTORICAL']),
  SUPERSEDED: new Set(['SUPERSEDED']),
  HISTORICAL: new Set(['HISTORICAL', 'ACTIVE', 'MONITORING', 'RESOLVED']),
};

export function hasAuthoritativeFault(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'yes' || normalized === 'true';
}

export function hasNonGoodFaultAssessment(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    if (typeof row.name !== 'string' || !row.name.trim()) return false;
    if (typeof row.value === 'boolean') return false;
    const rating = typeof row.value === 'number'
      ? row.value
      : (typeof row.value === 'string' && row.value.trim() ? Number(row.value) : Number.NaN);
    return Number.isInteger(rating) && rating >= 2 && rating <= 4;
  });
}

export function hasAuthoritativeDiagnosticFinding(
  faultDetected: unknown,
  faultData: unknown,
): boolean {
  return hasAuthoritativeFault(faultDetected) && hasNonGoodFaultAssessment(faultData);
}

export function parseDiagnosticLifecycle(value: unknown): DiagnosticLifecycle {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('diagnosticLifecycle must be a non-empty string');
  }
  const normalized = value.trim().toUpperCase();
  if (!DIAGNOSTIC_LIFECYCLES.includes(normalized as DiagnosticLifecycle)) {
    throw new Error(`Unsupported diagnosticLifecycle: ${normalized}`);
  }
  return normalized as DiagnosticLifecycle;
}

export function resolveCreationDiagnosticLifecycle(
  faultDetected: unknown,
  faultData: unknown,
  requestedLifecycle?: unknown,
): DiagnosticLifecycle {
  const hasFinding = hasAuthoritativeDiagnosticFinding(faultDetected, faultData);
  const lifecycle = requestedLifecycle === undefined || requestedLifecycle === null || requestedLifecycle === ''
    ? (hasFinding ? 'ACTIVE' : 'HISTORICAL')
    : parseDiagnosticLifecycle(requestedLifecycle);

  if (CURRENT_LIFECYCLES.has(lifecycle) && !hasFinding) {
    throw new Error(`${lifecycle} diagnostic lifecycle requires FaultDetected=Yes and at least one non-Good punched fault assessment`);
  }
  return lifecycle;
}

export function assertDiagnosticLifecycleTransition(input: {
  currentLifecycle?: unknown;
  nextLifecycle: unknown;
  resultingFaultDetected: unknown;
  resultingFaultData: unknown;
}): DiagnosticLifecycle {
  const current = input.currentLifecycle === undefined || input.currentLifecycle === null || input.currentLifecycle === ''
    ? 'HISTORICAL'
    : parseDiagnosticLifecycle(input.currentLifecycle);
  const next = parseDiagnosticLifecycle(input.nextLifecycle);

  if (!ALLOWED_TRANSITIONS[current].has(next)) {
    throw new Error(`Diagnostic lifecycle transition ${current} -> ${next} is not allowed`);
  }
  if (CURRENT_LIFECYCLES.has(next)
    && !hasAuthoritativeDiagnosticFinding(input.resultingFaultDetected, input.resultingFaultData)) {
    throw new Error(`${next} diagnostic lifecycle requires FaultDetected=Yes and at least one non-Good punched fault assessment`);
  }
  return next;
}

export function isCurrentDiagnosticLifecycle(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  return CURRENT_LIFECYCLES.has(parseDiagnosticLifecycle(value));
}
