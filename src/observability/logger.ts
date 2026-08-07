import pino from 'pino';
import pinoHttp from 'pino-http';
import { loggingConfig } from '../configDB';
import { getTraceContext } from './trace-context';

const redactedPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.x-cmms-crypto-key-id',
  'req.body.password',
  'req.body.confirmPassword',
  'req.body.newPassword',
  'req.body.confirmNewPassword',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.otp',
  'req.body.secret',
  'res.headers.set-cookie'
];

export const applicationLogger = pino({
  level: loggingConfig.level,
  base: {
    service: 'cmms-api',
    deployment: loggingConfig.deployment
  },
  redact: {
    paths: redactedPaths,
    censor: '[REDACTED]'
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  },
  mixin: () => {
    const context = getTraceContext();
    return context ? {
      requestId: context.requestId,
      correlationId: context.correlationId,
      traceId: context.traceId
    } : {};
  }
});

export const structuredHttpLogger = pinoHttp({
  logger: applicationLogger,
  quietReqLogger: true,
  customProps: (req, res) => ({
    requestId: (res as typeof res & { locals?: Record<string, unknown> }).locals?.['requestId'],
    correlationId: (res as typeof res & { locals?: Record<string, unknown> }).locals?.['correlationId'],
    traceId: (res as typeof res & { locals?: Record<string, unknown> }).locals?.['traceId'],
    tenantId: req.headers['accountid'],
    userId: (req as typeof req & { user?: { id?: string; _id?: string } }).user?.id
      || (req as typeof req & { user?: { id?: string; _id?: string } }).user?._id
  })
});
