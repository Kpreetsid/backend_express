import dotenv from 'dotenv';
dotenv.config();

export const environment = {
  type: process.env.NODE_ENV
}

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

export const database = {
  uri: process.env.MONGO_URI,
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!),
  userName: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  databaseName: process.env.DB_NAME!,
  authSource: process.env.DB_AUTH_SOURCE || 'admin',
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '100'),
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '10')
};

export const server = {
  port: parseInt(process.env.SERVER_PORT || '3000'),
  host: process.env.SERVER_HOST || 'localhost',
  protocol: process.env.SERVER_PROTOCOL || 'http'
};

export const auth = {
  secret: process.env.AUTH_SECRET!,
  external_secret: process.env.EXTERNAL_AUTH_SECRET!,
  expiresIn: process.env.AUTH_EXPIRES_IN || '1d',
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
  rotate: envBoolean(process.env.REFRESH_TOKEN_ROTATE, true)
};

export const payloadCrypto = {
  enabled: envBoolean(process.env.PAYLOAD_CRYPTO_ENABLED, true),
  strictMode: envBoolean(process.env.PAYLOAD_CRYPTO_STRICT_MODE, false),
  requestDecryptEnabled: envBoolean(process.env.PAYLOAD_CRYPTO_REQUEST_DECRYPT_ENABLED, true),
  responseEncryptEnabled: envBoolean(process.env.PAYLOAD_CRYPTO_RESPONSE_ENCRYPT_ENABLED, true),
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
  connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '3000', 10)
};

export const mailCredential = {
  service: process.env.MAIL_SERVICE!,
  host: process.env.MAIL_HOST!,
  port: parseInt(process.env.MAIL_PORT!),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER!,
  pass: process.env.MAIL_PASS!,
  from: process.env.MAIL_FROM!,
  loginUrl: process.env.MAIL_LOGIN_URL!
};

export const externalAPI = {
  URL: process.env.PROCESSOR_API_URL,
}

export const storageConfig = {
  driver: process.env.STORAGE_DRIVER || 'local',
  baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost:3000'
};
