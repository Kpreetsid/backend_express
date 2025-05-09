import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { userAuthentication, refreshUserAuthentication } from './authentication.service';

router.post('/authenticate', getData);
router.post('/refresh-token', refreshToken);

async function getData(req: Request, res: Response, next: NextFunction) {
    await userAuthentication(req, res, next);
};

async function refreshToken(req: Request, res: Response, next: NextFunction) {
    await refreshUserAuthentication(req, res, next);
}

export default router;