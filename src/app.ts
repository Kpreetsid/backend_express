import express, { Express, Request, Response, NextFunction, ErrorRequestHandler, Router } from 'express';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { isAuthenticated } from './_config/auth';
import routerIndex from './nonAuthRoutes';
import workRoutes from './work/work.routes';
import uploadRoutes from './upload/upload.routes';
import reportsRoutes from './reports/reports.routes';
import transactionRoutes from './transaction/transaction.routes';
import masterRoutes from './masters/master.routes';
import { fileLogger, activityLogger, errorMiddleware } from './middlewares';

const app: Express = express();
app.set('trust proxy', 1);
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(cors({ credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], origin: true }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileLogger);
app.use(activityLogger);
app.use('/', express.static(path.join(__dirname, '../uploadFiles')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/assets')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/asset_report')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/endpointImages')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/floor_map')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/locations')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/logo')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/mailers')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/observations')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/posts')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/user_profile_img')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/WO_docs')));
app.use('/', express.static(path.join(__dirname, '../uploadFiles/work_request')));
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests, please try again later.'
}));
app.use(compression({
  level: 9,
  threshold: 0,
  filter: (req: Request, res: Response) => {
    return !req.headers['x-no-compression'];
  }
}));

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: true, message: 'Welcome to CMMS ExpressJS API' });
});

const apiRouter: Router = Router();
apiRouter.use('/', routerIndex());
apiRouter.use('/upload', isAuthenticated, uploadRoutes());
apiRouter.use('/master', isAuthenticated, masterRoutes());
apiRouter.use('/work', isAuthenticated, workRoutes());
apiRouter.use('/reports', isAuthenticated, reportsRoutes());
apiRouter.use('/map', isAuthenticated, transactionRoutes());
app.use('/api', apiRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  const err = new Error('Requested resource not found.');
  (err as any).status = 404;
  next(err);
});

app.use(errorMiddleware as ErrorRequestHandler);

export default app;
