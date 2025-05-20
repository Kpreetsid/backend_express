import dotenv from 'dotenv';
dotenv.config();

export const database = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!),
  userName: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  databaseName: process.env.DB_NAME!,
};

export const server = {
  port: parseInt(process.env.SERVER_PORT || '3000'),
  host: process.env.SERVER_HOST || 'localhost',
  protocol: process.env.SERVER_PROTOCOL || 'http',
};

export const auth = {
  secret: process.env.AUTH_SECRET!,
  expiresIn: process.env.AUTH_EXPIRES_IN || '1d',
  algorithm: process.env.AUTH_ALGORITHM || 'HS256',
  issuer: process.env.AUTH_ISSUER!,
  audience: process.env.AUTH_AUDIENCE!,
};

export const mailCredential = {
  host: process.env.MAIL_HOST!,
  port: parseInt(process.env.MAIL_PORT!),
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER!,
  pass: process.env.MAIL_PASS!,
};
