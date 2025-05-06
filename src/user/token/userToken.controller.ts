import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { getAllUserTokens } from './userToken.service';

router.get('/', getData);

async function getData(req: Request, res: Response, next: NextFunction) {
  await getAllUserTokens(req, res, next);
};

export default router;
