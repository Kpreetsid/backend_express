import express, { NextFunction, Request, Response } from 'express';
const router = express.Router();
import { insert } from './registration.service';

router.post('/', create);

async function create(req: Request, res: Response, next: NextFunction) {
  await insert(req, res, next);
}

export default router;
