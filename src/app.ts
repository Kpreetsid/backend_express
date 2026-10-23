import express, { Express, Request, Response, NextFunction, ErrorRequestHandler, Router } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimiter } from './common/middlewares/rate-limit.middleware';
import { isAuthenticated } from './core/auth/auth.middleware';
import routerIndex from './routes/v1/public.routes';
import workRoutes from './modules/work-orders/routes/work-orders.routes';
import uploadRoutes from './modules/upload/routes/upload.routes';
import reportsRoutes from './modules/reports/routes/report.routes';
import transactionRoutes from './modules/mappings/routes/mapping.routes';
import masterRoutes from './routes/v1/master.routes';
import notificationRoutes from './modules/communications/routes/notification.routes';
import { logger, errorMiddleware } from './common/middlewares/index';
import { healthRouter, metricsRouter } from './routes/health.routes';
import { accountPermissionEventRoutes } from './routes/accountPermissionEvent.routes';
import { requestContextMiddleware } from './common/middlewares/request-context.middleware';
import { mongoSanitizeMiddleware } from './common/middlewares/mongo-sanitize.middleware';
import { cryptoRouter } from './routes/crypto.routes';
import { corsOptions } from './core/config/cors.config';
import { payloadCryptoRequestMiddleware, payloadCryptoResponseMiddleware } from './common/middlewares/payload-crypto.middleware';
import { csrfProtection } from './common/middlewares/csrf.middleware';
import { authenticatedStatic } from './common/middlewares/authenticatedStatic';
import { opcuaRoutes } from './routes/opcua.routes';
import { knowledgeBaseRoutes } from './modules/knowledge-base/routes/knowledge-base.routes';

const app: Express = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(requestContextMiddleware());
app.use(cors({ ...corsOptions, exposedHeaders: ['X-CMMS-Payload-Encrypted', 'X-CMMS-Crypto-Key-Id', 'X-CMMS-Crypto-Timestamp', 'X-CMMS-Crypto-Nonce', 'X-CMMS-Account-Encrypt-Payload', 'X-CMMS-Account-Encrypt-Response', 'X-Account-Permission-Version', 'ETag', 'Retry-After', 'Idempotency-Replayed'] }));
app.use(cookieParser());
app.use(csrfProtection);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '5mb' }));
app.use(express.urlencoded({ limit: process.env.URLENCODED_BODY_LIMIT || '5mb', extended: true }));
app.use(payloadCryptoResponseMiddleware());
app.use(payloadCryptoRequestMiddleware);
app.use(mongoSanitizeMiddleware());
app.use(logger.logMiddleware());
app.use(rateLimiter.globalLimiter);
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req: Request, res: Response) => {
    return !req.headers['x-no-compression'];
  }
}));
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

app.use('/', authenticatedStatic(path.join(__dirname, '../uploadFiles'), {
  excludedTopLevelDirectories: ['knowledge_base']
}));
uploadDirs.forEach((dir) => {
  const dirPath = path.join(__dirname, '../uploadFiles', dir);
  app.use('/', authenticatedStatic(dirPath));
  app.use(`/${dir}`, authenticatedStatic(dirPath));
  const apiBasePath = process.env.API_BASE_PATH || '/cmms_express';
  app.use(`${apiBasePath}/${dir}`, authenticatedStatic(dirPath));
});

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: true, message: 'Welcome to CMMS ExpressJS API' });
});

app.use('/health', healthRouter);
app.use('/metrics', metricsRouter);

const apiRouter: Router = Router();
apiRouter.use('/crypto', cryptoRouter);
apiRouter.use('/internal/account-permissions', accountPermissionEventRoutes());
apiRouter.use('/', routerIndex());
apiRouter.use('/upload', isAuthenticated, uploadRoutes());
apiRouter.use('/master', isAuthenticated, masterRoutes());
apiRouter.use('/opcua', isAuthenticated, opcuaRoutes());
apiRouter.use('/work', isAuthenticated, workRoutes());
apiRouter.use('/reports', isAuthenticated, reportsRoutes());
apiRouter.use('/map', isAuthenticated, transactionRoutes());
apiRouter.use('/notifications', isAuthenticated, notificationRoutes);
apiRouter.use('/knowledge-base', isAuthenticated, knowledgeBaseRoutes());

const apiBasePath = process.env.API_BASE_PATH || '/cmms_express';
app.use(['/api/v1', '/api', `${apiBasePath}/api/v1`, `${apiBasePath}/api`], apiRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  const err = new Error('Requested resource not found.');
  (err as any).status = 404;
  next(err);
});

app.use(errorMiddleware as ErrorRequestHandler);

export default app;
