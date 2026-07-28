import { NextFunction, Request, RequestHandler, Response } from 'express';
import crypto from 'crypto';

export const requestContextMiddleware = (): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const incomingId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
    const requestId = Array.isArray(incomingId) ? incomingId[0] : incomingId;
    const correlationId = requestId || crypto.randomUUID();

    res.locals['correlationId'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  };
};
