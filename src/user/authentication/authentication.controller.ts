import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { userAuthentication } from './authentication.service';

router.post('/authenticate', getData);

async function getData(req: Request, res: Response, next: NextFunction) {
    await userAuthentication(req, res, next);
};

export default router;