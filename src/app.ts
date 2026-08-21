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

const app: Express = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(requestContextMiddleware());
app.use(cors({ credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], origin: true, exposedHeaders: ['X-CMMS-Payload-Encrypted', 'X-CMMS-Crypto-Key-Id', 'X-CMMS-Crypto-Timestamp', 'X-CMMS-Crypto-Nonce'] }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '5mb' }));
app.use(express.urlencoded({ limit: process.env.URLENCODED_BODY_LIMIT || '5mb', extended: true }));
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

const apiBasePath = process.env.API_BASE_PATH || '/cmms_express';
app.use(['/api/v1', '/api', `${apiBasePath}/api/v1`, `${apiBasePath}/api`], apiRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  const err = new Error('Requested resource not found.');
  (err as any).status = 404;
  next(err);
});

app.use(errorMiddleware as ErrorRequestHandler);

export default app;
