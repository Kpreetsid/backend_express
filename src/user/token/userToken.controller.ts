import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import { getAllUserTokens } from './userToken.service';

router.get('/', getData);

// GET /user-tokens
async function getData(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAllUserTokens(req, res, next);
    if(data.length === 0) {
      res.status(404).json({ status: false, message: 'No user tokens found' });
    } else {
      res.status(200).json({ status: true, message: "User Token Data list retrieved.", data });
    }
  } catch (error) {
    next(error);
  }
};

export default router;
