import express, { Request, Response } from 'express';
import { errorMiddleware } from './middlewares/error.middleware';
const app = express();
app.use(express.json());

import userTokenController from './user/userToken.controller';
import accountMaster from './masters/company/company.controller';
import assetMaster from './masters/asset/asset.controller';
import logsController from './user/logs/logs.controller';
import assetController from './reports/asset/asset.controller';
import { activityLogger } from './middlewares/activityLogger.middleware';

app.use(activityLogger);

app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        message: 'Welcome to the Calculator API',
        endpoints: {
            '/api/add': 'Add two numbers',
            '/api/subtract': 'Subtract two numbers'
        }
    });
});

app.use('/api/account', accountMaster);
app.use('/api/asset', assetMaster);
app.use('/api/logs', logsController);
app.use('/api/reports/asset', assetController);
app.use('/api/user-tokens', userTokenController);

app.use((req, res, next) => {
    res.status(404);
    next(new Error(`API not found: ${req.originalUrl}`));
});

app.use(errorMiddleware);

export default app;
