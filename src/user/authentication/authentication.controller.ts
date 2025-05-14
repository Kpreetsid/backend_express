import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { userAuthentication, userLogOutService } from './authentication.service';

router.post('/login', getData);
router.get('/logout', userLogOut);

async function getData(req: Request, res: Response, next: NextFunction) {
    await userAuthentication(req, res, next);
};

async function userLogOut(req: Request, res: Response, next: NextFunction) {
    await userLogOutService(req, res, next);
};

export default router;