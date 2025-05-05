import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { getAll } from './floorMap.service';

router.get('/', getData);

async function getData(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAll(req, res, next);
    if(data.length === 0) {
      res.status(404).json({ status: false, message: 'No data found' });
    } else {
      res.status(200).json({ status: true, message: "Floor map list retrieved.", data });
    }
  } catch (error) {
    next(error);
  }
};

export default router;
