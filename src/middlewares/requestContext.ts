import { NextFunction, Request, RequestHandler, Response } from 'express';
import crypto from 'crypto';
import {
  createTraceContext,
  runWithTraceContext
} from '../observability/trace-context';

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const traceparentPattern = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export const requestContextMiddleware = (): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const incomingId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
    const candidateRequestId = Array.isArray(incomingId) ? incomingId[0] : incomingId;
    const requestId = candidateRequestId && requestIdPattern.test(candidateRequestId)
      ? candidateRequestId
      : crypto.randomUUID();
    const incomingTraceparent = Array.isArray(req.headers['traceparent'])
      ? req.headers['traceparent'][0]
      : req.headers['traceparent'];
    const traceMatch = incomingTraceparent?.toLowerCase().match(traceparentPattern);
    const traceId = traceMatch?.[1] || crypto.randomBytes(16).toString('hex');
    const context = createTraceContext(requestId, traceId);

    res.locals['requestId'] = requestId;
    res.locals['correlationId'] = requestId;
    res.locals['traceId'] = traceId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Correlation-ID', requestId);
    res.setHeader('traceparent', context.traceparent);
    runWithTraceContext(context, next);
  };
};
