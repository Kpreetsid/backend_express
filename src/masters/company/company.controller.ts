import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { getAllAccount } from './company.service';

router.get('/', getData);

async function getData(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAllAccount(req, res, next);
    if(data.length === 0) {
      res.status(404).json({ message: 'No company found' });
    }
    res.status(200).json({ status: true, message: "Companies list downloaded.", data });
  } catch (error) {
    next(error);
  }
};

export default router;
