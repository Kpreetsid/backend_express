import express, { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';

import { corsOptions } from './core/config/cors.config';
import {
  requestContextMiddleware,
  csrfProtection,
  payloadCryptoRequestMiddleware,
  payloadCryptoResponseMiddleware,
  mongoSanitizeMiddleware,
  logger,
  rateLimiter,
  errorMiddleware
} from './common/middlewares';
import { registerAppRoutes } from './routes';

const app: Express = express();
app.set('trust proxy', 1);

// Security & Context Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(requestContextMiddleware());
app.use(cors({
  ...corsOptions,
  exposedHeaders: [
    'X-CMMS-Payload-Encrypted',
    'X-CMMS-Crypto-Key-Id',
    'X-CMMS-Crypto-Timestamp',
    'X-CMMS-Crypto-Nonce',
    'X-Account-Permission-Version',
    'ETag',
    'Retry-After',
    'Idempotency-Replayed'
  ]
}));
app.use(cookieParser());
app.use(csrfProtection);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '5mb' }));
app.use(express.urlencoded({ limit: process.env.URLENCODED_BODY_LIMIT || '5mb', extended: true }));
app.use(payloadCryptoResponseMiddleware());
app.use(payloadCryptoRequestMiddleware);
app.use(mongoSanitizeMiddleware());
app.use(logger.logMiddleware());
app.use(rateLimiter.globalLimiter);

// Compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req: Request, res: Response) => {
    return !req.headers['x-no-compression'];
  }
}));

// Static File Directories
const uploadDirs = [
  'assets',
  'asset_report',
  'endpointImages',
  'floor_map',
  'locations',
  'logo',
  'mailers',
  'observations',
  'posts',
  'user_profile_img',
  'WO_docs',
  'work_request',
  'work_order'
];

app.use('/', express.static(path.join(__dirname, '../uploadFiles')));
uploadDirs.forEach((dir) => {
  const dirPath = path.join(__dirname, '../uploadFiles', dir);
  app.use('/', express.static(dirPath));
  app.use(`/${dir}`, express.static(dirPath));
  const apiBasePath = process.env.API_BASE_PATH || '/cmms_express';
  app.use(`${apiBasePath}/${dir}`, express.static(dirPath));
});

// Register Modular Enterprise Routes
registerAppRoutes(app);

// 404 Catch-all Handler
app.use((req: Request, res: Response, next: NextFunction) => {
  const err = new Error('Requested resource not found.');
  (err as any).status = 404;
  next(err);
});

// Centralized Error Handling Middleware
app.use(errorMiddleware as ErrorRequestHandler);

export default app;
