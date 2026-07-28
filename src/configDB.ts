import dotenv from 'dotenv';
dotenv.config();

const {
  NODE_ENV,
  MONGO_URI,
  DB_HOST,
  DB_PORT,
  DB_USERNAME,
  DB_PASSWORD,
  DB_NAME,
  DB_AUTH_SOURCE,
  DB_MAX_POOL_SIZE,
  DB_MIN_POOL_SIZE,
  SERVER_PORT,
  SERVER_HOST,
  SERVER_PROTOCOL,
  AUTH_SECRET,
  EXTERNAL_AUTH_SECRET,
  AUTH_EXPIRES_IN,
  AUTH_ALGORITHM,
  AUTH_ISSUER,
  AUTH_AUDIENCE,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN,
  PAYLOAD_CRYPTO_ENABLED,
  PAYLOAD_CRYPTO_STRICT_MODE,
  PAYLOAD_CRYPTO_REQUEST_DECRYPT_ENABLED,
  PAYLOAD_CRYPTO_RESPONSE_ENCRYPT_ENABLED,
  PAYLOAD_CRYPTO_MASTER_SECRET,
  PAYLOAD_CRYPTO_BOOTSTRAP_TTL_SECONDS,
  PAYLOAD_CRYPTO_REPLAY_TTL_SECONDS,
  MAIL_SERVICE,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS,
  MAIL_FROM,
  MAIL_LOGIN_URL,
  PROCESSOR_API_URL,
  STORAGE_DRIVER,
  STORAGE_BASE_URL
} = process.env;

export const environment = {
  type: NODE_ENV
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

export const database = {
  uri: MONGO_URI,
  host: DB_HOST!,
  port: parseInt(DB_PORT!),
  userName: DB_USERNAME,
  password: DB_PASSWORD,
  databaseName: DB_NAME!,
  authSource: DB_AUTH_SOURCE || 'admin',
  maxPoolSize: parseInt(DB_MAX_POOL_SIZE || '100'),
  minPoolSize: parseInt(DB_MIN_POOL_SIZE || '10')
};

export const server = {
  port: parseInt(SERVER_PORT || '3000'),
  host: SERVER_HOST || 'localhost',
  protocol: SERVER_PROTOCOL || 'http'
};

export const auth = {
  secret: AUTH_SECRET!,
  external_secret: EXTERNAL_AUTH_SECRET!,
  expiresIn: AUTH_EXPIRES_IN || '1d',
  algorithm: AUTH_ALGORITHM || 'HS256',
  issuer: AUTH_ISSUER!,
  audience: AUTH_AUDIENCE!,
};

export const refreshToken = {
  secret: REFRESH_TOKEN_SECRET || AUTH_SECRET!,
  expiresIn: REFRESH_TOKEN_EXPIRES_IN || '7d'
};

export const payloadCrypto = {
  enabled: envBoolean(PAYLOAD_CRYPTO_ENABLED, true),
  strictMode: envBoolean(PAYLOAD_CRYPTO_STRICT_MODE, false),
  requestDecryptEnabled: envBoolean(PAYLOAD_CRYPTO_REQUEST_DECRYPT_ENABLED, true),
  responseEncryptEnabled: envBoolean(PAYLOAD_CRYPTO_RESPONSE_ENCRYPT_ENABLED, true),
  masterSecret: PAYLOAD_CRYPTO_MASTER_SECRET,
  bootstrapTtlSeconds: parseInt(PAYLOAD_CRYPTO_BOOTSTRAP_TTL_SECONDS || '300', 10),
  replayTtlSeconds: parseInt(PAYLOAD_CRYPTO_REPLAY_TTL_SECONDS || '300', 10)
};

export const mailCredential = {
  service: MAIL_SERVICE!,
  host: MAIL_HOST!,
  port: parseInt(MAIL_PORT!),
  secure: MAIL_SECURE === 'true',
  user: MAIL_USER!,
  pass: MAIL_PASS!,
  from: MAIL_FROM!,
  loginUrl: MAIL_LOGIN_URL!
};

export const externalAPI = {
  URL: PROCESSOR_API_URL,
}

export const storageConfig = {
  driver: STORAGE_DRIVER || 'local',
  baseUrl: STORAGE_BASE_URL || 'http://localhost:3000'
};
