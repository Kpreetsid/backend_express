import express, { NextFunction, Request, Response } from 'express';
const router = express.Router();
import { getAllAccount, getDataById, updateById, removeById } from './company.service';

router.get('/', getData);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);

async function getData(req: Request, res: Response, next: NextFunction) {
  await getAllAccount(req, res, next);
};

async function getById(req: Request, res: Response, next: NextFunction) {
  await getDataById(req, res, next);
}

async function update(req: Request, res: Response, next: NextFunction) {
  await updateById(req, res, next);
}

async function remove(req: Request, res: Response, next: NextFunction) {
  await removeById(req, res, next);
}

export default router;
