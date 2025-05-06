import express, { Application, Request, Response, NextFunction  } from 'express';
import { errorMiddleware } from './middlewares/error';
const app: Application = express();

app.use(express.json());
import path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { attachUserData, authenticateJwt } from './_config/auth';

app.use(helmet());
// app.use(morgan('dev'));
app.use(morgan('combined'));

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
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

import authentication from './user/authentication/authentication.controller';
import userTokenController from './user/token/userToken.controller';
import accountMaster from './masters/company/company.controller';
import assetMaster from './masters/asset/asset.controller';
import locationMaster from './masters/location/location.controller';
import userMaster from './masters/user/user.controller';
import partMaster from './masters/part/part.controller';
import blogController from './masters/post/post.controller';
import observationMaster from './masters/observation/observation.controller';
import formCategoryMaster from './masters/formCategory/formCategory.controller';
import workRequest from './work/request/request.controller';
import locationReport from './reports/location/location.controller';
import logsController from './user/logs/logs.controller';
import assetReportController from './reports/asset/asset.controller';
import floorMapController from './floorMap/floorMap.controller';
import userRoleMenuController from './masters/user/role/role.controller';
import workOrder from './work/order/order.controller';
import commentController from './work/comments/comment.controller';
import userLocationController from './transaction/mapUserLocation/userLocation.controller';
import { activityLogger } from './middlewares/logger';

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
masterRouter.use('/blog', blogController);
router.use('/master', authenticateJwt, attachUserData, masterRouter);

const reportRouter = express.Router();
reportRouter.use('/location', locationReport);
reportRouter.use('/asset', assetReportController);
router.use('/report', authenticateJwt, attachUserData, reportRouter);

const transactionRouter = express.Router();
transactionRouter.use('/map-user-location', userLocationController);
router.use('/transaction', authenticateJwt, attachUserData, transactionRouter);

const workRouter = express.Router();
workRouter.use('/request', workRequest);
workRouter.use('/order', workOrder);
workRouter.use('/comments', commentController);
router.use('/work', authenticateJwt, attachUserData, workRouter);

const userRouter = express.Router();
userRouter.use('/logs', logsController);
userRouter.use('/tokens', userTokenController);
userRouter.use('/role-menu', userRoleMenuController);
router.use('/user', authenticateJwt, attachUserData, userRouter);

router.use('/floor-map', authenticateJwt, attachUserData, floorMapController);

app.use('/api', router);

app.use((req: Request, res: Response, next: NextFunction) => {
  const error = new Error('Requested resource not found.');
  (error as any).status = 404;
  next(error);
});

app.use(errorMiddleware);

export default app;
