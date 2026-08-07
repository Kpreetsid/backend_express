import express, { Express, Request, Response, NextFunction, ErrorRequestHandler, Router } from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimiter } from './middlewares/rateLimits';
import { isAuthenticated } from './_config/auth';
import routerIndex from './nonAuthRoutes';
import workRoutes from './work/work.routes';
import uploadRoutes from './upload/upload.routes';
import reportsRoutes from './reports/reports.routes';
import transactionRoutes from './transaction/transaction.routes';
import masterRoutes from './masters/master.routes';
import notificationRoutes from './notification/notification.routes';
import { logger, errorMiddleware } from './middlewares';
import { healthRouter, metricsRouter } from './routes/health.routes';
import { requestContextMiddleware } from './middlewares/requestContext';
import { mongoSanitizeMiddleware } from './middlewares/mongoSanitize';
import { cryptoRouter } from './routes/crypto.routes';
import { payloadCryptoRequestMiddleware, payloadCryptoResponseMiddleware } from './middlewares/payloadCrypto.middleware';
import { corsOptions } from './_config/cors';
import { server as serverConfig, storageConfig } from './configDB';
import { structuredHttpLogger } from './observability/logger';
import { httpMetricsMiddleware } from './observability/metrics';

const app: Express = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(requestContextMiddleware());
app.use(structuredHttpLogger);
app.use(httpMetricsMiddleware());
app.use(cors({
  ...corsOptions,
  exposedHeaders: [
    'X-CMMS-Payload-Encrypted',
    'X-CMMS-Crypto-Key-Id',
    'X-CMMS-Crypto-Timestamp',
    'X-CMMS-Crypto-Nonce',
    'X-Request-ID',
    'X-Correlation-ID',
    'X-CSRF-Token',
    'traceparent',
    'ETag',
    'Retry-After',
    'Idempotency-Replayed'
  ]
}));
app.use(express.json({ limit: serverConfig.jsonBodyLimit }));
app.use(express.urlencoded({ limit: serverConfig.urlencodedBodyLimit, extended: true }));
app.use(payloadCryptoResponseMiddleware());
app.use(payloadCryptoRequestMiddleware);
app.use(mongoSanitizeMiddleware());
app.use(logger.logMiddleware());
app.use(rateLimiter.globalLimiter);
app.use(compression({
  level: 9,
  threshold: 0,
  filter: (req: Request, res: Response) => {
    return !req.headers['x-no-compression'];
  }
}));
if (storageConfig.driver === 'local' || storageConfig.dualReadLocalFallbackEnabled) {
  app.use('/', express.static(path.join(__dirname, '../uploadFiles')));
}

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: true, message: 'Welcome to CMMS ExpressJS API' });
});

app.use('/health', healthRouter);
app.use('/metrics', metricsRouter);

const apiRouter: Router = Router();
apiRouter.use('/crypto', cryptoRouter);
apiRouter.use('/', routerIndex());
apiRouter.use('/upload', isAuthenticated, uploadRoutes());
apiRouter.use('/master', isAuthenticated, masterRoutes());
apiRouter.use('/work', isAuthenticated, workRoutes());
apiRouter.use('/reports', isAuthenticated, reportsRoutes());
apiRouter.use('/map', isAuthenticated, transactionRoutes());
apiRouter.use('/notifications', isAuthenticated, notificationRoutes);

const apiBasePath = serverConfig.apiBasePath;
app.use(['/api/v1', '/api', `${apiBasePath}/api/v1`, `${apiBasePath}/api`], apiRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  const err = new Error('Requested resource not found.');
  (err as any).status = 404;
  next(err);
});

app.use(errorMiddleware as ErrorRequestHandler);

export default app;
