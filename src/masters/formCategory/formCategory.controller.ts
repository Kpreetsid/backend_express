import express, { NextFunction, Request, Response } from 'express';
const router = express.Router();
import { getAll } from './formCategory.service';

router.get('/', getData);

async function getData(req: Request, res: Response, next: NextFunction) {
  await getAll(req, res, next);
};

export default router;
