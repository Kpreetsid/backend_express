import express from 'express';
import { errorMiddleware } from './middlewares/error.middleware';
const app = express();
app.use(express.json());

import userTokenController from './user/userToken.controller';
import accountMaster from './masters/company/company.controller';
import assetMaster from './masters/asset/asset.controller';
import locationMaster from './masters/location/location.controller';
import logsController from './user/logs/logs.controller';
import assetController from './reports/asset/asset.controller';
import floorMapController from './floorMap/floorMap.controller';
import { activityLogger } from './middlewares/activityLogger.middleware';

app.use(activityLogger);

app.use('/api/account', accountMaster);
app.use('/api/asset', assetMaster);
app.use('/api/location', locationMaster);
app.use('/api/logs', logsController);
app.use('/api/reports/asset', assetController);
app.use('/api/user-tokens', userTokenController);
app.use('/api/floor-map', floorMapController);

app.use((req, res, next) => {
    res.status(404);
    next(new Error(`Requested resource not found.`));
});

app.use(errorMiddleware);

export default app;
