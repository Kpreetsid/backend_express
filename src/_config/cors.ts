import { CorsOptions } from 'cors';

const splitOrigins = (value?: string): string[] => {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const getAllowedOrigins = (): string[] => {
  const configured = splitOrigins(process.env.ALLOWED_ORIGINS || process.env.SOCKET_CORS_ORIGIN);
  if (configured.length) return configured;

  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  return [ ];
};

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV !== 'production') {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }

  return false;
};

export const corsOptions: CorsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS policy'));
  }
};
