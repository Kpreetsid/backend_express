import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getExternalData } from './externalAPI';
import {
  createTraceContext,
  runWithTraceContext
} from '../observability/trace-context';

vi.mock('axios', () => ({ default: vi.fn() }));
vi.mock('../configDB', () => ({
  externalAPI: { URL: 'https://processor.example/' }
}));
vi.mock('../observability/logger', () => ({
  applicationLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('external processor request boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: { status: true }
    });
  });

  it('propagates a deterministic idempotency key without changing existing headers', async () => {
    await getExternalData(
      '/endPointApi/',
      'POST',
      { asset_id: 'asset-1' },
      'processor-service-token',
      'actor-1',
      'event-1:0'
    );

    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://processor.example/endPointApi/',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'processor-service-token',
        'X-User-Id': 'actor-1',
        'Idempotency-Key': 'event-1:0'
      }
    }));
  });

  it('omits the idempotency header for compatibility with existing callers', async () => {
    await getExternalData('/health', 'GET', {}, 'token', 'actor');

    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.not.objectContaining({ 'Idempotency-Key': expect.anything() })
    }));
  });

  it('propagates request, correlation, and W3C trace context', async () => {
    const context = createTraceContext(
      'request-123',
      '0123456789abcdef0123456789abcdef'
    );

    await runWithTraceContext(context, () =>
      getExternalData('/health', 'GET', {}, 'token', 'actor')
    );

    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({
        'X-Request-ID': 'request-123',
        'X-Correlation-ID': 'request-123',
        traceparent: expect.stringMatching(
          /^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/
        )
      })
    }));
  });
});
