import 'dotenv/config';
import { createHash } from 'node:crypto';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export interface SapMiddlewareConfig {
  enabled: boolean;
  baseUrl: string;
  createPath: string;
  apiKey: string;
  timeoutMs: number;
  defaultOrderType: string;
  defaultMaintenancePlant: string;
}

export interface SapMaintenanceOverrides {
  OrderType?: string;
  MaintenancePlant?: string;
  Equipment?: string;
  Priority?: string;
  SystemStatus?: string;
}

export interface CmmsIdentity {
  cmmsAccountId: string;
  cmmsUserId: string;
}

export type SapAcknowledgement =
  | { status: 'disabled'; operation: SapOperation }
  | { status: 'acknowledged'; operation: SapOperation; idempotencyKey: string; sapStatus: number; record: unknown;
      recovery?: 'backfilled' | 'already-absent' }
  | { status: 'failed'; operation: SapOperation; code: string; message: string;
      middlewareStatus?: number; sapStatus?: number };

export type SapOperation = 'create' | 'update' | 'delete';
type SapAcknowledged = Extract<SapAcknowledgement, { status: 'acknowledged' }>;

type RequestExecutor = (config: AxiosRequestConfig) => Promise<AxiosResponse>;

function boolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (!['true', 'false'].includes(value)) throw new Error('Invalid SAP_MIDDLEWARE_ENABLED');
  return value === 'true';
}

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error('Invalid SAP_MIDDLEWARE_TIMEOUT_MS');
  }
  return parsed;
}

export function loadSapMiddlewareConfig(env: NodeJS.ProcessEnv = process.env): SapMiddlewareConfig {
  return {
    enabled: boolean(env.SAP_MIDDLEWARE_ENABLED, false),
    baseUrl: env.SAP_MIDDLEWARE_URL?.trim() || '',
    createPath: env.SAP_MIDDLEWARE_CREATE_PATH?.trim() || '/api/v1/master/sap/records',
    apiKey: env.SAP_MIDDLEWARE_API_KEY?.trim() || '',
    timeoutMs: integer(env.SAP_MIDDLEWARE_TIMEOUT_MS, 15000, 1, 300000),
    defaultOrderType: env.SAP_MIDDLEWARE_DEFAULT_ORDER_TYPE?.trim() || '',
    defaultMaintenancePlant: env.SAP_MIDDLEWARE_DEFAULT_MAINTENANCE_PLANT?.trim() || ''
  };
}

function validateConfig(config: SapMiddlewareConfig): string {
  if (!config.baseUrl) throw new Error('SAP_MIDDLEWARE_URL is required when SAP middleware is enabled');
  if (config.apiKey.length < 32 || config.apiKey.length > 512) {
    throw new Error('SAP_MIDDLEWARE_API_KEY must contain 32-512 characters');
  }
  if (!config.createPath.startsWith('/') || config.createPath.startsWith('//') || config.createPath.includes('#')) {
    throw new Error('SAP_MIDDLEWARE_CREATE_PATH must be a relative path');
  }
  const url = new URL(config.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('SAP_MIDDLEWARE_URL must be an HTTP(S) URL without embedded credentials');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('SAP_MIDDLEWARE_URL must use HTTPS in production');
  }
  return `${config.baseUrl.replace(/\/+$/, '')}${config.createPath}`;
}

function requiredText(value: unknown, field: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new Error(`Invalid SAP field mapping: ${field}`);
  return text;
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new Error(`Invalid SAP field mapping: ${field}`);
  }
  return value.trim() || undefined;
}

function maintenanceOrderId(orderNumber: unknown): string {
  const digits = String(orderNumber || '').replace(/\D/g, '');
  if (!/^\d{1,12}$/.test(digits)) throw new Error('Work order number cannot be mapped to SAP MaintenanceOrder');
  return digits;
}

function sapStatus(status: unknown): string {
  const mapping: Record<string, string> = {
    Open: 'Open',
    'In-Progress': 'In Progress',
    Completed: 'Completed',
    Blocked: 'Blocked',
    'On-Hold': 'On Hold'
  };
  return mapping[String(status || '')] || 'Open';
}

export function mapWorkOrderToSap(workOrder: any, overrides: SapMaintenanceOverrides = {},
  defaults: Pick<SapMiddlewareConfig, 'defaultOrderType' | 'defaultMaintenancePlant'> = {
    defaultOrderType: '', defaultMaintenancePlant: ''
  }): Record<string, string> {
  const payload: Record<string, string> = {
    MaintenanceOrder: maintenanceOrderId(workOrder?.order_no),
    MaintenanceOrderDesc: requiredText(workOrder?.title, 'MaintenanceOrderDesc', 500),
    Description: optionalText(workOrder?.description, 'Description', 10000) || '',
    Priority: optionalText(overrides.Priority ?? workOrder?.priority, 'Priority', 500) || 'Medium',
    SystemStatus: optionalText(overrides.SystemStatus, 'SystemStatus', 500) || sapStatus(workOrder?.status)
  };
  const optionalFields = {
    OrderType: optionalText(overrides.OrderType ?? defaults.defaultOrderType, 'OrderType', 500),
    MaintenancePlant: optionalText(overrides.MaintenancePlant ?? defaults.defaultMaintenancePlant, 'MaintenancePlant', 500),
    Equipment: optionalText(overrides.Equipment ?? workOrder?.asset?.asset_id, 'Equipment', 500)
  };
  for (const [key, value] of Object.entries(optionalFields)) if (value) payload[key] = value;
  return payload;
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return;
  const response = error.response;
  return response && typeof response === 'object' && 'status' in response && typeof response.status === 'number'
    ? response.status : undefined;
}

function downstreamSapStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) return;
  const response = error.response;
  if (!response || typeof response !== 'object' || !('data' in response)) return;
  const data = response.data;
  if (!data || typeof data !== 'object' || !('error' in data)) return;
  const detail = data.error;
  if (!detail || typeof detail !== 'object' || !('sapStatus' in detail)) return;
  return typeof detail.sapStatus === 'number' ? detail.sapStatus : undefined;
}

function middlewareMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('response' in error)) return 'SAP middleware request failed';
  const response = error.response;
  if (!response || typeof response !== 'object' || !('data' in response)) return 'SAP middleware request failed';
  const data = response.data;
  if (!data || typeof data !== 'object' || !('error' in data)) return 'SAP middleware request failed';
  const detail = data.error;
  if (!detail || typeof detail !== 'object' || !('message' in detail) || typeof detail.message !== 'string') {
    return 'SAP middleware request failed';
  }
  return detail.message.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500) || 'SAP middleware request failed';
}

function acknowledgement(response: AxiosResponse, operation: SapOperation,
  idempotencyKey: string): SapAcknowledged {
  const received = response.data as Record<string, unknown> | undefined;
  return {
    status: 'acknowledged',
    operation,
    idempotencyKey: typeof received?.idempotencyKey === 'string'
      ? received.idempotencyKey : idempotencyKey,
    sapStatus: typeof received?.sapStatus === 'number' ? received.sapStatus : response.status,
    record: received?.record ?? received ?? null
  };
}

export class SapMiddlewareClient {
  constructor(private config: SapMiddlewareConfig = loadSapMiddlewareConfig(),
    private request: RequestExecutor = axios) {}

  async createWorkOrder(workOrder: any, overrides: SapMaintenanceOverrides = {},
    identity?: CmmsIdentity): Promise<SapAcknowledgement> {
    return this.mutate('create', 'POST', workOrder, overrides, identity);
  }

  async updateWorkOrder(workOrder: any, overrides: SapMaintenanceOverrides = {}): Promise<SapAcknowledgement> {
    return this.mutate('update', 'PATCH', workOrder, overrides);
  }

  async deleteWorkOrder(workOrder: any): Promise<SapAcknowledgement> {
    return this.mutate('delete', 'DELETE', workOrder, {});
  }

  private async mutate(operation: SapOperation, method: 'POST' | 'PATCH' | 'DELETE', workOrder: any,
    overrides: SapMaintenanceOverrides, identity?: CmmsIdentity): Promise<SapAcknowledgement> {
    if (!this.config.enabled) return { status: 'disabled', operation };
    let url: string;
    let recordsUrl: string;
    let mapped: Record<string, string>;
    let payload: Record<string, string> | undefined;
    let idempotencyKey: string;
    try {
      recordsUrl = validateConfig(this.config);
      const localId = String(workOrder?._id || workOrder?.id || '');
      if (!/^[A-Za-z0-9._:-]{1,180}$/.test(localId)) {
        throw new Error('Work order ID cannot be used as an idempotency key');
      }
      const sapRecordId = maintenanceOrderId(workOrder?.order_no);
      mapped = mapWorkOrderToSap(workOrder, overrides, this.config);
      payload = operation === 'delete' ? undefined : operation === 'create' ? {
        ...mapped,
        ...(identity ? {
          cmmsAccountId: requiredText(identity.cmmsAccountId, 'cmmsAccountId', 200),
          cmmsUserId: requiredText(identity.cmmsUserId, 'cmmsUserId', 200)
        } : {})
      }
        : Object.fromEntries(Object.entries(mapped).filter(([key]) => key !== 'MaintenanceOrder'));
      url = operation === 'create' ? recordsUrl : `${recordsUrl}/${encodeURIComponent(sapRecordId)}`;
      const fingerprint = payload
        ? createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 20)
        : sapRecordId;
      idempotencyKey = operation === 'create' ? `work-order-${localId}`
        : `work-order-${localId}-${operation}-${fingerprint}`;
    } catch (error) {
      return { status: 'failed', operation, code: 'SAP_MAPPING_FAILED',
        message: error instanceof Error ? error.message : 'SAP field mapping failed' };
    }

    try {
      const response = await this.request({
        method,
        url,
        headers: {
          ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
          'X-API-Key': this.config.apiKey,
          'Idempotency-Key': idempotencyKey
        },
        ...(payload === undefined ? {} : { data: payload }),
        timeout: this.config.timeoutMs,
        maxRedirects: 0,
        maxBodyLength: 102400,
        maxContentLength: 1048576,
        validateStatus: status => status >= 200 && status < 300
      });
      return acknowledgement(response, operation, idempotencyKey);
    } catch (error) {
      const middlewareStatus = errorStatus(error);
      const sapStatus = downstreamSapStatus(error);

      // Legacy CMMS work orders can predate the outbound SAP integration. If an
      // update proves the record is absent, create its current snapshot once so
      // subsequent updates and deletes use the normal entity route.
      if (operation === 'update' && sapStatus === 404) {
        const fingerprint = createHash('sha256').update(JSON.stringify(mapped)).digest('hex').slice(0, 20);
        const localId = String(workOrder?._id || workOrder?.id || '');
        const backfillKey = `work-order-${localId}-backfill-${fingerprint}`;
        try {
          const response = await this.request({
            method: 'POST',
            url: recordsUrl,
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.config.apiKey,
              'Idempotency-Key': backfillKey
            },
            data: mapped,
            timeout: this.config.timeoutMs,
            maxRedirects: 0,
            maxBodyLength: 102400,
            maxContentLength: 1048576,
            validateStatus: status => status >= 200 && status < 300
          });
          return { ...acknowledgement(response, operation, backfillKey), recovery: 'backfilled' };
        } catch (backfillError) {
          const backfillStatus = downstreamSapStatus(backfillError) ?? errorStatus(backfillError);
          return { status: 'failed', operation, code: 'SAP_MIDDLEWARE_FAILED',
            message: middlewareMessage(backfillError),
            ...(backfillStatus === undefined ? {} : { sapStatus: backfillStatus }) };
        }
      }

      // DELETE is idempotent: a missing SAP record already has the requested
      // final state and should not make an otherwise successful CMMS delete fail.
      if (operation === 'delete' && sapStatus === 404) {
        return { status: 'acknowledged', operation, idempotencyKey, sapStatus: 404, record: null,
          recovery: 'already-absent' };
      }

      return { status: 'failed', operation, code: 'SAP_MIDDLEWARE_FAILED', message: middlewareMessage(error),
        ...(middlewareStatus === undefined ? {} : { middlewareStatus }),
        ...(sapStatus === undefined ? {} : { sapStatus }) };
    }
  }
}

export const sapMiddlewareClient = new SapMiddlewareClient();
