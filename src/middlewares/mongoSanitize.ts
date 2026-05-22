import { NextFunction, Request, RequestHandler, Response } from 'express';

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const source = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(source)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    sanitized[key] = sanitizeValue(nestedValue);
  }

  return sanitized;
};

const sanitizeRequestProperty = (req: Request, property: 'body' | 'params' | 'query') => {
  const currentValue = req[property];
  if (!currentValue) return;

  Object.defineProperty(req, property, {
    value: sanitizeValue(currentValue),
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
