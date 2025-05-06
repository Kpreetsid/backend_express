import express, { NextFunction, Request, Response } from 'express';
const router = express.Router();
import { getAllAccount } from './company.service';

router.get('/', getData);

async function getData(req: Request, res: Response, next: NextFunction) {
  await getAllAccount(req, res, next);
};

export default router;
