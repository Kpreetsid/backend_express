import express, { Application, Request, Response, NextFunction  } from 'express';
import { errorMiddleware } from './middlewares/error.middleware';
const app: Application = express();

app.use(express.json());

import bodyParser from 'body-parser';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { authenticateJwt } from './_config/auth';

app.use(helmet());
app.use(morgan('dev'));
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.'
});
app.use(limiter);
const router = express.Router();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(compression({
  level: 9,
  threshold: 0,
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

import authentication from './user/authentication/authentication.controller';
import userTokenController from './user/token/userToken.controller';
import accountMaster from './masters/company/company.controller';
import assetMaster from './masters/asset/asset.controller';
import locationMaster from './masters/location/location.controller';
import userMaster from './masters/user/user.controller';
import partMaster from './masters/part/part.controller';
import observationMaster from './masters/observation/observation.controller';
import formCategoryMaster from './masters/formCategory/formCategory.controller';
import workRequest from './work/request/request.controller';
import locationReport from './reports/location/location.controller';
import logsController from './user/logs/logs.controller';
import assetReportController from './reports/asset/asset.controller';
import floorMapController from './floorMap/floorMap.controller';
import userRoleMenuController from './masters/user/role/role.controller';
import workOrder from './work/order/order.controller';
import userLocationController from './transaction/mapUserLocation/userLocation.controller';
import { activityLogger } from './middlewares/activityLogger.middleware';

app.use(activityLogger);
app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
router.use('/authenticate', authentication);

const masterRouter = express.Router();
masterRouter.use('/company', accountMaster);
masterRouter.use('/asset', assetMaster);
masterRouter.use('/location', locationMaster);
masterRouter.use('/user', userMaster);
masterRouter.use('/part', partMaster);
masterRouter.use('/observation', observationMaster);
masterRouter.use('/form-category', formCategoryMaster);
router.use('/master', authenticateJwt, masterRouter);

const reportRouter = express.Router();
reportRouter.use('/location', locationReport);
reportRouter.use('/asset', assetReportController);
router.use('/report', authenticateJwt, reportRouter);

const transactionRouter = express.Router();
transactionRouter.use('/map-user-location', userLocationController);
router.use('/transaction',authenticateJwt, transactionRouter);

const workRouter = express.Router();
workRouter.use('/request', workRequest);
workRouter.use('/order', workOrder);
router.use('/work', authenticateJwt, workRouter);

const userRouter = express.Router();
userRouter.use('/logs', logsController);
userRouter.use('/tokens', userTokenController);
userRouter.use('/role-menu', userRoleMenuController);
router.use('/user', authenticateJwt, userRouter);

router.use('/floor-map', authenticateJwt, floorMapController);

app.use('/api', router);

app.use((req: Request, res: Response, next: NextFunction) => {
  const error = new Error('Requested resource not found.');
  (error as any).status = 404;
  next(error);
});

app.use(errorMiddleware);

export default app;
