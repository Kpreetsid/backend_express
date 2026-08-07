import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { externalAPI } from '../configDB';
import { authenticationAnomalyCounter } from '../observability/metrics';

const safeMatches = (supplied: string, expected: string): boolean => {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length
    && timingSafeEqual(suppliedBuffer, expectedBuffer);
};

export const isProcessorAuthenticated = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const configuredToken = externalAPI.token || '';
  if (!configuredToken) {
    next(Object.assign(
      new Error('Processor authentication is unavailable'),
      { status: 503, name: 'ServiceUnavailableError' }
    ));
    return;
  }

  const header = req.headers['x-cmms-processor-token'];
  const suppliedToken = Array.isArray(header) ? header[0] || '' : header || '';
  if (!safeMatches(suppliedToken, configuredToken)) {
    authenticationAnomalyCounter.inc({ reason: 'processor_invalid_credential' });
    next(Object.assign(
      new Error('Invalid processor credential'),
      { status: 401, name: 'InvalidTokenError' }
    ));
    return;
  }

  next();
};
