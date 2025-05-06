import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { getAllUserLogs } from './logs.service';

router.get('/', getData);

async function getData(req: Request, res: Response, next: NextFunction) {
  await getAllUserLogs(req, res, next);
};

export default router;