import express, { NextFunction, Request, Response } from 'express';
const router = express.Router();
import { getAll, getDataById, insert, updateById, removeById } from './asset.service';

router.get('/', getData);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

async function getData(req: Request, res: Response, next: NextFunction) {
  await getAll(req, res, next);
};

async function getById(req: Request, res: Response, next: NextFunction) {
  await getDataById(req, res, next);
}

async function create(req: Request, res: Response, next: NextFunction) {
  await insert(req, res, next);
}

async function update(req: Request, res: Response, next: NextFunction) {
  await updateById(req, res, next);
}

async function remove(req: Request, res: Response, next: NextFunction) {
  await removeById(req, res, next);
}

export default router;
