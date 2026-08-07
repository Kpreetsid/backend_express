import axios, { AxiosRequestConfig } from 'axios';
import { externalAPI } from '../configDB';
import { applicationLogger } from '../observability/logger';
import {
  createTraceparent,
  getTraceContext
} from '../observability/trace-context';

const successStatusCodes = new Set([200, 201, 202, 203, 204, 205, 206, 207, 208, 226]);

export const getExternalData = async (
  path: string,
  method: string,
  body: unknown,
  token: string,
  userID: string,
  idempotencyKey?: string
) => {
  const baseUrl = (externalAPI.URL || '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const apiUrl = `${baseUrl}${normalizedPath}`;
  const traceContext = getTraceContext();

  try {
    applicationLogger.debug({ apiUrl, method, userId: userID }, 'External API request started');
    const config: AxiosRequestConfig = {
      method,
      url: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'X-User-Id': userID,
        ...(traceContext ? {
          'X-Request-ID': traceContext.requestId,
          'X-Correlation-ID': traceContext.correlationId,
          traceparent: createTraceparent(traceContext.traceId)
        } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      data: body,
      timeout: 3 * 60 * 1000
    };
    const response = await axios(config);
    if (!successStatusCodes.has(response.status)) {
      throw new Error(`External API returned status code ${response.status}: ${response.statusText}`);
    }
    applicationLogger.info(
      { apiUrl, method, status: response.status, userId: userID },
      'External API request completed'
    );
    return response.data;
  } catch (error) {
    applicationLogger.error(
      { err: error, apiUrl, method, userId: userID },
      'External API request failed'
    );
    throw error;
  }
};
