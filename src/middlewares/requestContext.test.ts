import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestContextMiddleware } from './requestContext';
import { getTraceContext } from '../observability/trace-context';

const createApp = () => {
  const app = express();
  app.use(requestContextMiddleware());
  app.get('/context', (_req, res) => {
    res.json({
      requestId: res.locals['requestId'],
      correlationId: res.locals['correlationId'],
      traceId: res.locals['traceId'],
      asyncContext: getTraceContext()
    });
  });
  return app;
};

describe('requestContextMiddleware', () => {
  it('preserves a valid request identifier in additive compatibility headers', async () => {
    const response = await request(createApp())
      .get('/context')
      .set('X-Request-ID', 'request-123');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('request-123');
    expect(response.headers['x-correlation-id']).toBe('request-123');
    expect(response.body.requestId).toBe('request-123');
    expect(response.body.asyncContext).toMatchObject({
      requestId: 'request-123',
      correlationId: 'request-123'
    });
  });

  it('rejects unsafe identifiers and emits a valid W3C traceparent', async () => {
    const response = await request(createApp())
      .get('/context')
      .set('X-Request-ID', 'unsafe identifier with spaces');

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('continues an incoming trace id with a new parent span', async () => {
    const incomingTraceId = '0123456789abcdef0123456789abcdef';
    const response = await request(createApp())
      .get('/context')
      .set('traceparent', `00-${incomingTraceId}-0123456789abcdef-01`);

    expect(response.body.traceId).toBe(incomingTraceId);
    expect(response.headers['traceparent']).toContain(incomingTraceId);
    expect(response.headers['traceparent']).not.toBe(`00-${incomingTraceId}-0123456789abcdef-01`);
  });
});
