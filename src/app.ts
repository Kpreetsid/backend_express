import express, { Application, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { errorMiddleware } from './middlewares/error';
import { fileLogger } from './middlewares/fileLogger';
import { activityLogger } from './middlewares/logger';
import { isAuthenticated } from './_config/auth';
import authorizeRouterIndex from './authRoutes';
import routerIndex from './nonAuthRoutes';
import masterRoute from './masters/master.routes';
import workRoutes from './work/work.routes';
import uploadRoutes from './upload/upload.routes';
import reportsRoutes from './reports/reports.routes';
import transactionRoutes from './transaction/transaction.routes';

const app: Application = express();

app.use(helmet());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());
app.use(fileLogger);
app.use(activityLogger);
app.use('/', express.static(path.join(__dirname, '../uploadFiles')));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
}));

app.use(compression({
  level: 9,
  threshold: 0,
  filter: (req: Request, res: Response) => {
    return !req.headers['x-no-compression'];
  }
}));

app.use('/api', routerIndex());
app.use('/api', isAuthenticated, authorizeRouterIndex());
app.use('/api/upload', isAuthenticated, uploadRoutes());
app.use('/api/master', isAuthenticated, masterRoute());
app.use('/api/work', isAuthenticated, workRoutes());
app.use('/api/reports', isAuthenticated, reportsRoutes());
app.use('/api/map', isAuthenticated, transactionRoutes());

app.use((req: Request, res: Response, next: NextFunction) => {
  const err = new Error('Requested resource not found.');
  (err as any).status = 404;
  next(err);
});

app.use(errorMiddleware as ErrorRequestHandler);

export default app;
