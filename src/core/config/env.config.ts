import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const environment = {
  type: process.env.NODE_ENV
};

const envBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'enabled', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'disabled', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const envString = (value: string | undefined, defaultValue: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.startsWith('||') || normalized.includes('process.env') || normalized.includes(' as ')) {
    return defaultValue;
  }
  return normalized;
};

const envCookieName = (value: string | undefined, defaultValue: string): string => {
  const normalized = envString(value, defaultValue);
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(normalized) ? normalized : defaultValue;
};

const envSameSite = (value: string | undefined, defaultValue: 'lax' | 'strict' | 'none'): 'lax' | 'strict' | 'none' => {
  const normalized = envString(value, defaultValue).toLowerCase();
  return ['lax', 'strict', 'none'].includes(normalized) ? normalized as 'lax' | 'strict' | 'none' : defaultValue;
};

const envNumber = (value: string | undefined, defaultValue: number): number => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export const database = {
  hosts: envString(process.env.DB_HOSTS, ''),
  host: envString(process.env.DB_HOST, 'localhost'),
  port: envNumber(process.env.DB_PORT, 27017),
  userName: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  databaseName: envString(process.env.DB_NAME, 'cmms'),
  authSource: process.env.DB_AUTH_SOURCE || 'admin',
  maxPoolSize: envNumber(process.env.DB_MAX_POOL_SIZE, 100),
  minPoolSize: envNumber(process.env.DB_MIN_POOL_SIZE, 10),
  directConnection: envBoolean(process.env.DB_DIRECT_CONNECTION, false),
  retryWrites: envBoolean(process.env.DB_RETRY_WRITES, false),
  autoIndex: envBoolean(process.env.DB_AUTO_INDEX, environment.type !== 'production'),
  connectTimeoutMS: envNumber(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
  serverSelectionTimeoutMS: envNumber(process.env.DB_SERVER_SELECTION_TIMEOUT_MS, 5000),
  socketTimeoutMS: envNumber(process.env.DB_SOCKET_TIMEOUT_MS, 45000),
  maxIdleTimeMS: envNumber(process.env.DB_MAX_IDLE_TIME_MS, 60000)
};

export const server = {
  port: parseInt(process.env.SERVER_PORT || '3000', 10),
  host: process.env.SERVER_HOST || 'localhost',
  protocol: process.env.SERVER_PROTOCOL || 'http'
};

export const auth = {
  secret: process.env.AUTH_SECRET!,
  external_secret: process.env.EXTERNAL_AUTH_SECRET!,
  expiresIn: process.env.AUTH_EXPIRES_IN || '604800',
  algorithm: process.env.AUTH_ALGORITHM || 'HS256',
  issuer: process.env.AUTH_ISSUER!,
  audience: process.env.AUTH_AUDIENCE!,
};

export const refreshToken = {
  secret: envString(process.env.REFRESH_TOKEN_SECRET, process.env.AUTH_SECRET!),
  expiresIn: envString(process.env.REFRESH_TOKEN_EXPIRES_IN, '7d'),
  cookieName: envCookieName(process.env.REFRESH_TOKEN_COOKIE_NAME, 'cmms_refresh_token'),
  cookiePath: envString(process.env.REFRESH_TOKEN_COOKIE_PATH, '/'),
  cookieSecure: envBoolean(process.env.REFRESH_TOKEN_COOKIE_SECURE, environment.type === 'production'),
  cookieSameSite: envSameSite(process.env.REFRESH_TOKEN_COOKIE_SAMESITE, 'lax'),
  rotate: envBoolean(process.env.REFRESH_TOKEN_ROTATE, true),
  reuseGraceSeconds: Math.max(0, envNumber(process.env.REFRESH_TOKEN_REUSE_GRACE_SECONDS, 5))
};

export const cookieAuth = {
  accessCookieName: envCookieName(process.env.AUTH_ACCESS_COOKIE_NAME, 'cmms_access_token'),
  accountCookieName: envCookieName(process.env.AUTH_ACCOUNT_COOKIE_NAME, 'cmms_account_id'),
  stateCookieName: envCookieName(process.env.AUTH_STATE_COOKIE_NAME, 'cmms_auth_state'),
  csrfCookieName: envCookieName(process.env.AUTH_CSRF_COOKIE_NAME, 'cmms_csrf'),
  path: envString(process.env.AUTH_COOKIE_PATH, '/'),
  secure: envBoolean(process.env.AUTH_COOKIE_SECURE, environment.type === 'production'),
  sameSite: envSameSite(process.env.AUTH_COOKIE_SAMESITE, 'lax'),
  domain: envString(process.env.AUTH_COOKIE_DOMAIN, '')
};

export const payloadCrypto = {
  enabled: envBoolean(process.env.PAYLOAD_CRYPTO_ENABLED, false),
  strictMode: envBoolean(process.env.PAYLOAD_CRYPTO_STRICT_MODE, false),
  requestDecryptEnabled: envBoolean(process.env.PAYLOAD_CRYPTO_REQUEST_DECRYPT_ENABLED, false),
  responseEncryptEnabled: envBoolean(process.env.PAYLOAD_CRYPTO_RESPONSE_ENCRYPT_ENABLED, false),
  masterSecret: process.env.PAYLOAD_CRYPTO_MASTER_SECRET,
  bootstrapTtlSeconds: parseInt(process.env.PAYLOAD_CRYPTO_BOOTSTRAP_TTL_SECONDS || '300', 10),
  replayTtlSeconds: parseInt(process.env.PAYLOAD_CRYPTO_REPLAY_TTL_SECONDS || '300', 10)
};

export const redisConfig = {
  enabled: envBoolean(process.env.REDIS_ENABLED, false),
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'cmms',
  defaultTtlSeconds: parseInt(process.env.REDIS_DEFAULT_TTL_SECONDS || '300', 10),
  statusTtlSeconds: parseInt(process.env.REDIS_STATUS_TTL_SECONDS || '30', 10),
  connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '3000', 10),
  sessionEnabled: envBoolean(process.env.REDIS_SESSION_ENABLED, true)
};

export const cacheConfig = {
  changeStreamsEnabled: envBoolean(process.env.CACHE_CHANGE_STREAMS_ENABLED, false)
};

export const mailCredential = {
  service: process.env.MAIL_SERVICE!,
  host: process.env.MAIL_HOST!,
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER!,
  pass: process.env.MAIL_PASS!,
  from: process.env.MAIL_FROM!,
  loginUrl: process.env.MAIL_LOGIN_URL!
};

export const externalAPI = {
  URL: process.env.PROCESSOR_API_URL,
};

export const permissionSync = {
  serviceKey: envString(process.env.PERMISSION_SYNC_SERVICE_KEY, '')
};

export const storageConfig = {
  driver: process.env.STORAGE_DRIVER || 'local',
  baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost:3000'
};
