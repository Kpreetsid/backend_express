import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { getAll } from './userWorkOrder.servce';

router.get('/', getData);

async function getData(req: Request, res: Response, next: NextFunction) {
  await getAll(req, res, next);
};

export default router;
