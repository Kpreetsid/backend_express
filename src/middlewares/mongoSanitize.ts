import { NextFunction, Request, RequestHandler, Response } from 'express';

// A boolean only: strict consumers can reject removed keys without retaining
// the original payload. Existing consumers keep the same sanitized values.
const bodyKeysRemoved = Symbol('bodyKeysRemoved');
type SanitizedRequest = Request & { [bodyKeysRemoved]?: boolean };
export const hasSanitizedBodyKeys = (req: Request): boolean => (req as SanitizedRequest)[bodyKeysRemoved] === true;

const sanitizeValue = (value: unknown, onRemovedKey: () => void): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, onRemovedKey));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const source = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(source)) {
    // Assignment to this key can consume it through Object.prototype's setter.
    // Mark strict requests while preserving legacy sanitization behavior.
    if (key === '__proto__') onRemovedKey();
    if (key.startsWith('$') || key.includes('.')) {
      onRemovedKey();
      continue;
    }
    sanitized[key] = sanitizeValue(nestedValue, onRemovedKey);
  }

  return sanitized;
};

const sanitizeRequestProperty = (req: Request, property: 'body' | 'params' | 'query') => {
  const currentValue = req[property];
  if (!currentValue) return;

  Object.defineProperty(req, property, {
    value: sanitizeValue(currentValue, () => {
      if (property === 'body') (req as SanitizedRequest)[bodyKeysRemoved] = true;
    }),
    configurable: true,
    enumerable: true,
    writable: true
  });
};

export const mongoSanitizeMiddleware = (): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    sanitizeRequestProperty(req, 'body');
    sanitizeRequestProperty(req, 'params');
    sanitizeRequestProperty(req, 'query');
    next();
  };
};
