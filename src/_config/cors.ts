import { CorsOptions } from 'cors';
import { corsConfig } from '../configDB';

const defaultAllowedOrigins = [
  'http://localhost:4200',
  'https://new.presageinsights.ai',
  'https://app.presageinsights.ai'
];

export const getAllowedOrigins = (): string[] => {
  const configured = corsConfig.allowedOrigins;
  if (configured.length) return Array.from(new Set([...configured, ...defaultAllowedOrigins]));
  return defaultAllowedOrigins;
};

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) return true;

  if (corsConfig.allowDevelopmentLocalhost) {
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
