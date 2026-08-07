import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceContext {
  requestId: string;
  correlationId: string;
  traceId: string;
  traceparent: string;
}

const traceContextStorage = new AsyncLocalStorage<TraceContext>();

export const createTraceparent = (traceId: string): string =>
  `00-${traceId}-${crypto.randomBytes(8).toString('hex')}-01`;

export const createTraceContext = (
  correlationId: string,
  traceId: string = crypto.randomBytes(16).toString('hex')
): TraceContext => ({
  requestId: correlationId,
  correlationId,
  traceId,
  traceparent: createTraceparent(traceId)
});

export const runWithTraceContext = <T>(
  context: TraceContext,
  callback: () => T
): T => traceContextStorage.run(context, callback);

export const getTraceContext = (): TraceContext | undefined =>
  traceContextStorage.getStore();
