import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const optionalString = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGO_URI: optionalString,
  DB_HOST: optionalString,
  DB_PORT: optionalString,
  DB_USERNAME: optionalString,
  DB_PASSWORD: optionalString,
  DB_NAME: optionalString,
  DB_AUTH_SOURCE: optionalString,
  DB_MAX_POOL_SIZE: optionalString,
  DB_MIN_POOL_SIZE: optionalString,
  DB_AUTO_INDEX: optionalString,
  DB_RETRY_WRITES: optionalString,
  SERVER_PORT: optionalString,
  SERVER_HOST: optionalString,
  SERVER_PROTOCOL: optionalString,
  API_BASE_PATH: optionalString,
  JSON_BODY_LIMIT: optionalString,
  URLENCODED_BODY_LIMIT: optionalString,
  AUTH_SECRET: optionalString,
  EXTERNAL_AUTH_SECRET: optionalString,
  AUTH_EXPIRES_IN: optionalString,
  AUTH_ALGORITHM: z.enum(['HS256', 'HS384', 'HS512']).optional(),
  AUTH_ISSUER: optionalString,
  AUTH_AUDIENCE: optionalString,
  REFRESH_TOKEN_SECRET: optionalString,
  REFRESH_TOKEN_EXPIRES_IN: optionalString,
  WEB_REFRESH_COOKIE_ENABLED: optionalString,
  PAYLOAD_CRYPTO_ENABLED: optionalString,
  PAYLOAD_CRYPTO_STRICT_MODE: optionalString,
  PAYLOAD_CRYPTO_REQUEST_DECRYPT_ENABLED: optionalString,
  PAYLOAD_CRYPTO_RESPONSE_ENCRYPT_ENABLED: optionalString,
  PAYLOAD_CRYPTO_MASTER_SECRET: optionalString,
  PAYLOAD_CRYPTO_BOOTSTRAP_TTL_SECONDS: optionalString,
  PAYLOAD_CRYPTO_REPLAY_TTL_SECONDS: optionalString,
  MAIL_SERVICE: optionalString,
  MAIL_HOST: optionalString,
  MAIL_PORT: optionalString,
  MAIL_SECURE: optionalString,
  MAIL_USER: optionalString,
  MAIL_PASS: optionalString,
  MAIL_FROM: optionalString,
  MAIL_LOGIN_URL: optionalString,
  MAIL_TLS_REJECT_UNAUTHORIZED: optionalString,
  PROCESSOR_API_URL: optionalString,
  PROCESSOR_API_TOKEN: optionalString,
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_BASE_URL: optionalString,
  S3_BUCKET: optionalString,
  S3_REGION: optionalString,
  S3_ENDPOINT: optionalString,
  S3_FORCE_PATH_STYLE: optionalString,
  S3_SIGNED_URL_TTL_SECONDS: optionalString,
  S3_DUAL_READ_LOCAL_FALLBACK_ENABLED: optionalString,
  S3_DUAL_READ_LOCAL_BASE_URL: optionalString,
  PDF_JOB_RETENTION_DAYS: optionalString,
  PDF_JOB_MAX_REQUEST_BYTES: optionalString,
  UPLOAD_TENANT_QUOTA_BYTES: optionalString,
  UPLOAD_QUOTA_RESERVATION_TTL_SECONDS: optionalString,
  MALWARE_SCAN_ENABLED: optionalString,
  MALWARE_SCAN_URL: optionalString,
  MALWARE_SCAN_TIMEOUT_MS: optionalString,
  REDIS_ENABLED: optionalString,
  REDIS_URL: optionalString,
  REDIS_KEY_PREFIX: optionalString,
  REDIS_CONNECT_TIMEOUT_MS: optionalString,
  QUEUE_ENABLED: optionalString,
  QUEUE_PREFIX: optionalString,
  QUEUE_WORKER_CONCURRENCY: optionalString,
  DOMAIN_EVENT_OUTBOX_ENABLED: optionalString,
  OUTBOX_MAX_ATTEMPTS: optionalString,
  ALLOWED_ORIGINS: optionalString,
  SOCKET_CORS_ORIGIN: optionalString,
  LOG_LEVEL: optionalString,
  LOG_PRETTY: optionalString,
  APP_VERSION: optionalString,
  OTEL_ENABLED: optionalString,
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString,
  OTEL_EXPORTER_OTLP_HEADERS: optionalString,
  METRICS_TOKEN: optionalString,
  SCHEDULER_LOCK_TTL_MS: optionalString,
  USER_LOG_RETENTION_DAYS: optionalString
}).superRefine((env, context) => {
  if (
    envBooleanForValidation(env.S3_DUAL_READ_LOCAL_FALLBACK_ENABLED)
    && env.STORAGE_DRIVER !== 's3'
  ) {
    context.addIssue({
      code: 'custom',
      path: ['S3_DUAL_READ_LOCAL_FALLBACK_ENABLED'],
      message: 'S3_DUAL_READ_LOCAL_FALLBACK_ENABLED requires STORAGE_DRIVER=s3'
    });
  }
  if (
    envBooleanForValidation(env.DOMAIN_EVENT_OUTBOX_ENABLED)
    && !envBooleanForValidation(env.QUEUE_ENABLED)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['DOMAIN_EVENT_OUTBOX_ENABLED'],
      message: 'DOMAIN_EVENT_OUTBOX_ENABLED requires QUEUE_ENABLED'
    });
  }
  if (env.NODE_ENV !== 'production') return;

  const requireValue = (key: keyof typeof env, message: string) => {
    if (!env[key]) context.addIssue({ code: 'custom', path: [key], message });
  };

  if (!env.MONGO_URI && !(env.DB_HOST && env.DB_PORT && env.DB_NAME)) {
    context.addIssue({
      code: 'custom',
      path: ['MONGO_URI'],
      message: 'Provide MONGO_URI or DB_HOST, DB_PORT, and DB_NAME in production'
    });
  }
  requireValue('AUTH_SECRET', 'AUTH_SECRET is required in production');
  requireValue('EXTERNAL_AUTH_SECRET', 'EXTERNAL_AUTH_SECRET is required in production');
  requireValue('REFRESH_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET is required in production');
  requireValue('AUTH_ISSUER', 'AUTH_ISSUER is required in production');
  requireValue('AUTH_AUDIENCE', 'AUTH_AUDIENCE is required in production');
  requireValue('ALLOWED_ORIGINS', 'ALLOWED_ORIGINS is required in production');
  requireValue('PROCESSOR_API_URL', 'PROCESSOR_API_URL is required in production');
  requireValue('PROCESSOR_API_TOKEN', 'PROCESSOR_API_TOKEN is required in production');
  if (!envBooleanForValidation(env.REDIS_ENABLED)) {
    context.addIssue({
      code: 'custom',
      path: ['REDIS_ENABLED'],
      message: 'Distributed Redis coordination must be enabled in production'
    });
  }
  requireValue('REDIS_URL', 'REDIS_URL is required in production');
  if (env.REDIS_URL && !env.REDIS_URL.startsWith('rediss://')) {
    context.addIssue({
      code: 'custom',
      path: ['REDIS_URL'],
      message: 'REDIS_URL must use TLS (rediss://) in production'
    });
  }
  if (!envBooleanForValidation(env.QUEUE_ENABLED)) {
    context.addIssue({
      code: 'custom',
      path: ['QUEUE_ENABLED'],
      message: 'The durable background queue must be enabled in production'
    });
  }
  const productionOutboxEnabled = env.DOMAIN_EVENT_OUTBOX_ENABLED === undefined
    ? envBooleanForValidation(env.QUEUE_ENABLED)
    : envBooleanForValidation(env.DOMAIN_EVENT_OUTBOX_ENABLED);
  if (!productionOutboxEnabled) {
    context.addIssue({
      code: 'custom',
      path: ['DOMAIN_EVENT_OUTBOX_ENABLED'],
      message: 'The transactional domain-event outbox must be enabled in production'
    });
  }

  if ((env.AUTH_SECRET?.length || 0) < 32) {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_SECRET'],
      message: 'AUTH_SECRET must contain at least 32 characters in production'
    });
  }
  if ((env.EXTERNAL_AUTH_SECRET?.length || 0) < 32) {
    context.addIssue({
      code: 'custom',
      path: ['EXTERNAL_AUTH_SECRET'],
      message: 'EXTERNAL_AUTH_SECRET must contain at least 32 characters in production'
    });
  }
  if ((env.REFRESH_TOKEN_SECRET?.length || 0) < 32) {
    context.addIssue({
      code: 'custom',
      path: ['REFRESH_TOKEN_SECRET'],
      message: 'REFRESH_TOKEN_SECRET must contain at least 32 characters in production'
    });
  }
  if (
    env.AUTH_SECRET
    && [env.EXTERNAL_AUTH_SECRET, env.REFRESH_TOKEN_SECRET].includes(env.AUTH_SECRET)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_SECRET'],
      message: 'Access, external-auth, and refresh-token secrets must be distinct in production'
    });
  }
  if (
    env.EXTERNAL_AUTH_SECRET
    && env.REFRESH_TOKEN_SECRET
    && env.EXTERNAL_AUTH_SECRET === env.REFRESH_TOKEN_SECRET
  ) {
    context.addIssue({
      code: 'custom',
      path: ['REFRESH_TOKEN_SECRET'],
      message: 'Access, external-auth, and refresh-token secrets must be distinct in production'
    });
  }
  if (envBooleanForValidation(env.PAYLOAD_CRYPTO_ENABLED ?? 'true')) {
    requireValue(
      'PAYLOAD_CRYPTO_MASTER_SECRET',
      'PAYLOAD_CRYPTO_MASTER_SECRET is required when payload crypto is enabled in production'
    );
    if ((env.PAYLOAD_CRYPTO_MASTER_SECRET?.length || 0) < 32) {
      context.addIssue({
        code: 'custom',
        path: ['PAYLOAD_CRYPTO_MASTER_SECRET'],
        message: 'PAYLOAD_CRYPTO_MASTER_SECRET must contain at least 32 characters in production'
      });
    }
  }
  if (!env.MAIL_SERVICE && !env.MAIL_HOST) {
    context.addIssue({
      code: 'custom',
      path: ['MAIL_HOST'],
      message: 'MAIL_SERVICE or MAIL_HOST is required in production'
    });
  }
  requireValue('MAIL_USER', 'MAIL_USER is required in production');
  requireValue('MAIL_PASS', 'MAIL_PASS is required in production');
  requireValue('MAIL_FROM', 'MAIL_FROM is required in production');
  if (!envBooleanForValidation(env.MAIL_TLS_REJECT_UNAUTHORIZED ?? 'true')) {
    context.addIssue({
      code: 'custom',
      path: ['MAIL_TLS_REJECT_UNAUTHORIZED'],
      message: 'SMTP certificate verification cannot be disabled in production'
    });
  }
  if (env.STORAGE_DRIVER === 'local') {
    context.addIssue({
      code: 'custom',
      path: ['STORAGE_DRIVER'],
      message: 'Instance-local storage is not allowed in production; use s3'
    });
  }
  if (env.STORAGE_DRIVER === 's3') {
    requireValue('S3_BUCKET', 'S3_BUCKET is required for the s3 storage driver');
    requireValue('S3_REGION', 'S3_REGION is required for the s3 storage driver');
    if (!envBooleanForValidation(env.MALWARE_SCAN_ENABLED)) {
      context.addIssue({
        code: 'custom',
        path: ['MALWARE_SCAN_ENABLED'],
        message: 'Malware scanning must be enabled with the production s3 storage driver'
      });
    }
    requireValue('MALWARE_SCAN_URL', 'MALWARE_SCAN_URL is required for production uploads');
    if (envBooleanForValidation(env.S3_DUAL_READ_LOCAL_FALLBACK_ENABLED)) {
      requireValue(
        'S3_DUAL_READ_LOCAL_BASE_URL',
        'S3_DUAL_READ_LOCAL_BASE_URL is required while the local migration fallback is enabled'
      );
    }
  }
  requireValue(
    'UPLOAD_TENANT_QUOTA_BYTES',
    'UPLOAD_TENANT_QUOTA_BYTES is required in production'
  );
  if (
    env.UPLOAD_TENANT_QUOTA_BYTES
    && (!/^\d+$/.test(env.UPLOAD_TENANT_QUOTA_BYTES)
      || Number(env.UPLOAD_TENANT_QUOTA_BYTES) <= 0)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['UPLOAD_TENANT_QUOTA_BYTES'],
      message: 'UPLOAD_TENANT_QUOTA_BYTES must be a positive integer in production'
    });
  }
  if (!envBooleanForValidation(env.OTEL_ENABLED)) {
    context.addIssue({
      code: 'custom',
      path: ['OTEL_ENABLED'],
      message: 'OpenTelemetry must be enabled in production'
    });
  }
  if (envBooleanForValidation(env.OTEL_ENABLED) && !env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    context.addIssue({
      code: 'custom',
      path: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
      message: 'OTEL_EXPORTER_OTLP_ENDPOINT is required when OTEL_ENABLED is true'
    });
  }
  requireValue('METRICS_TOKEN', 'METRICS_TOKEN is required in production');
  if ((env.METRICS_TOKEN?.length || 0) < 32) {
    context.addIssue({
      code: 'custom',
      path: ['METRICS_TOKEN'],
      message: 'METRICS_TOKEN must contain at least 32 characters in production'
    });
  }
});

function envBooleanForValidation(value: string | undefined): boolean {
  return ['true', '1', 'yes', 'enabled', 'on'].includes((value || '').trim().toLowerCase());
}

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid CMMS configuration: ${details}`);
}

const env = result.data;

const envBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'enabled', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'disabled', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const positiveInteger = (value: string | undefined, defaultValue: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};

const splitOrigins = (value: string | undefined): string[] =>
  (value || '').split(',').map((origin) => origin.trim()).filter(Boolean);

export const environment = {
  type: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test'
};

export const database = {
  uri: env.MONGO_URI,
  host: env.DB_HOST || 'localhost',
  port: positiveInteger(env.DB_PORT, 27017),
  userName: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  databaseName: env.DB_NAME || 'cmms',
  authSource: env.DB_AUTH_SOURCE || 'admin',
  maxPoolSize: positiveInteger(env.DB_MAX_POOL_SIZE, 100),
  minPoolSize: positiveInteger(env.DB_MIN_POOL_SIZE, 10),
  autoIndex: envBoolean(env.DB_AUTO_INDEX, env.NODE_ENV !== 'production'),
  retryWrites: envBoolean(env.DB_RETRY_WRITES, true)
};

export const server = {
  port: positiveInteger(env.SERVER_PORT, 3000),
  host: env.SERVER_HOST || 'localhost',
  protocol: env.SERVER_PROTOCOL || 'http',
  apiBasePath: env.API_BASE_PATH || '/cmms_express',
  jsonBodyLimit: env.JSON_BODY_LIMIT || '5mb',
  urlencodedBodyLimit: env.URLENCODED_BODY_LIMIT || '5mb'
};

export const auth = {
  secret: env.AUTH_SECRET || 'development-only-auth-secret-change-me',
  external_secret: env.EXTERNAL_AUTH_SECRET || env.AUTH_SECRET || 'development-only-external-secret',
  expiresIn: env.AUTH_EXPIRES_IN || '1d',
  algorithm: env.AUTH_ALGORITHM || 'HS256',
  issuer: env.AUTH_ISSUER || 'cmms-api',
  audience: env.AUTH_AUDIENCE || 'cmms-client',
  webRefreshCookieEnabled: envBoolean(env.WEB_REFRESH_COOKIE_ENABLED, false)
};

export const refreshToken = {
  secret: env.REFRESH_TOKEN_SECRET || env.AUTH_SECRET || 'development-only-refresh-secret',
  expiresIn: env.REFRESH_TOKEN_EXPIRES_IN || '7d'
};

export const payloadCrypto = {
  enabled: envBoolean(env.PAYLOAD_CRYPTO_ENABLED, true),
  strictMode: envBoolean(env.PAYLOAD_CRYPTO_STRICT_MODE, false),
  requestDecryptEnabled: envBoolean(env.PAYLOAD_CRYPTO_REQUEST_DECRYPT_ENABLED, true),
  responseEncryptEnabled: envBoolean(env.PAYLOAD_CRYPTO_RESPONSE_ENCRYPT_ENABLED, true),
  masterSecret: env.PAYLOAD_CRYPTO_MASTER_SECRET,
  bootstrapTtlSeconds: positiveInteger(env.PAYLOAD_CRYPTO_BOOTSTRAP_TTL_SECONDS, 300),
  replayTtlSeconds: positiveInteger(env.PAYLOAD_CRYPTO_REPLAY_TTL_SECONDS, 300)
};

export const mailCredential = {
  service: env.MAIL_SERVICE || '',
  host: env.MAIL_HOST || '',
  port: positiveInteger(env.MAIL_PORT, 587),
  secure: envBoolean(env.MAIL_SECURE, false),
  user: env.MAIL_USER || '',
  pass: env.MAIL_PASS || '',
  from: env.MAIL_FROM || '',
  loginUrl: env.MAIL_LOGIN_URL || '',
  tlsRejectUnauthorized: envBoolean(env.MAIL_TLS_REJECT_UNAUTHORIZED, true)
};

export const externalAPI = {
  URL: env.PROCESSOR_API_URL,
  token: env.PROCESSOR_API_TOKEN
};

export const storageConfig = {
  driver: env.STORAGE_DRIVER,
  baseUrl: env.STORAGE_BASE_URL || 'http://localhost:3000',
  bucket: env.S3_BUCKET,
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: envBoolean(env.S3_FORCE_PATH_STYLE, false),
  signedUrlTtlSeconds: positiveInteger(env.S3_SIGNED_URL_TTL_SECONDS, 300),
  dualReadLocalFallbackEnabled: envBoolean(env.S3_DUAL_READ_LOCAL_FALLBACK_ENABLED, false),
  dualReadLocalBaseUrl: env.S3_DUAL_READ_LOCAL_BASE_URL
};

export const assetReportPdfJobConfig = {
  retentionDays: positiveInteger(env.PDF_JOB_RETENTION_DAYS, 7),
  maxRequestBytes: positiveInteger(env.PDF_JOB_MAX_REQUEST_BYTES, 1024 * 1024)
};

export const uploadQuotaConfig = {
  tenantQuotaBytes: positiveInteger(env.UPLOAD_TENANT_QUOTA_BYTES, 0),
  reservationTtlSeconds: positiveInteger(env.UPLOAD_QUOTA_RESERVATION_TTL_SECONDS, 900)
};

export const malwareScanConfig = {
  enabled: envBoolean(env.MALWARE_SCAN_ENABLED, false),
  url: env.MALWARE_SCAN_URL,
  timeoutMs: positiveInteger(env.MALWARE_SCAN_TIMEOUT_MS, 15_000)
};

export const redisConfig = {
  enabled: envBoolean(env.REDIS_ENABLED, false),
  url: env.REDIS_URL,
  keyPrefix: env.REDIS_KEY_PREFIX || `cmms:{${env.NODE_ENV}}`,
  connectTimeoutMs: positiveInteger(env.REDIS_CONNECT_TIMEOUT_MS, 5000)
};

export const queueConfig = {
  enabled: envBoolean(env.QUEUE_ENABLED, false),
  prefix: env.QUEUE_PREFIX || `${redisConfig.keyPrefix}:global:queue`,
  workerConcurrency: positiveInteger(env.QUEUE_WORKER_CONCURRENCY, 10),
  domainEventOutboxEnabled: envBoolean(
    env.DOMAIN_EVENT_OUTBOX_ENABLED,
    envBoolean(env.QUEUE_ENABLED, false)
  ),
  outboxMaxAttempts: positiveInteger(env.OUTBOX_MAX_ATTEMPTS, 10)
};

export const corsConfig = {
  allowedOrigins: splitOrigins(env.ALLOWED_ORIGINS || env.SOCKET_CORS_ORIGIN),
  allowDevelopmentLocalhost: env.NODE_ENV !== 'production'
};

export const loggingConfig = {
  level: env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  pretty: envBoolean(env.LOG_PRETTY, env.NODE_ENV !== 'production'),
  deployment: env.APP_VERSION || 'development'
};

export const telemetryConfig = {
  enabled: envBoolean(env.OTEL_ENABLED, false),
  endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  headers: (env.OTEL_EXPORTER_OTLP_HEADERS || '')
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((headers, pair) => {
      const separator = pair.indexOf('=');
      if (separator > 0) headers[pair.slice(0, separator)] = pair.slice(separator + 1);
      return headers;
    }, {})
};

export const metricsConfig = {
  token: env.METRICS_TOKEN
};

export const schedulerConfig = {
  lockTtlMs: positiveInteger(env.SCHEDULER_LOCK_TTL_MS, 10 * 60 * 1000)
};

export const auditConfig = {
  userLogRetentionDays: positiveInteger(env.USER_LOG_RETENTION_DAYS, 180)
};

export const validateConfiguration = (): void => {
  // Import-time validation is intentional; this function provides an explicit startup/test hook.
};
