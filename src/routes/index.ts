import { Express, Request, Response } from 'express';
import { healthRouter, metricsRouter } from './health.routes';
import createV1Router from './v1';

export const registerAppRoutes = (app: Express): void => {
  app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ status: true, message: 'Welcome to CMMS ExpressJS API' });
  });

  app.use('/health', healthRouter);
  app.use('/metrics', metricsRouter);

  const apiBasePath = process.env.API_BASE_PATH || '/cmms_express';
  const v1Router = createV1Router();
  app.use(['/api/v1', '/api', `${apiBasePath}/api/v1`, `${apiBasePath}/api`], v1Router);
};

export * from './health.routes';
export * from './crypto.routes';
export * from './accountPermissionEvent.routes';
export * from './v1';
export default registerAppRoutes;
