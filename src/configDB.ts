import dotenv from 'dotenv';
dotenv.config();

export const environment = {
  type: process.env.NODE_ENV
}

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
