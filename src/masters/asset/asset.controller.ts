import express, { NextFunction, Request, Response } from 'express';
const router = express.Router();
import { getAll, getDataById, insert, updateById, removeById, getAssetsTreeData, createAssetsWithImage, getAssetsFilteredData } from './asset.service';
import { uploadSingle } from '../../_config/fileUpload';

router.get('/', getData);
router.post('/getTree', getAssetsTree);
router.get('/:id', getById);
router.post('/getFiltered', getFilteredData);
router.post('/', create);
router.post('/createWithImage', uploadSingle('image'), newAssetsWithImage);
router.put('/:id', update);
router.delete('/:id', remove);

async function getData(req: Request, res: Response, next: NextFunction) {
  await getAll(req, res, next);
};

async function getAssetsTree(req: Request, res: Response, next: NextFunction) {
  await getAssetsTreeData(req, res, next);
}

async function getFilteredData(req: Request, res: Response, next: NextFunction) {
  await getAssetsFilteredData(req, res, next);
}

async function getById(req: Request, res: Response, next: NextFunction) {
  await getDataById(req, res, next);
}

async function create(req: Request, res: Response, next: NextFunction) {
  await insert(req, res, next);
}

async function newAssetsWithImage(req: Request, res: Response, next: NextFunction) {
  console.log(req.file);
  await createAssetsWithImage(req, res, next);
}

async function update(req: Request, res: Response, next: NextFunction) {
  await updateById(req, res, next);
}

async function remove(req: Request, res: Response, next: NextFunction) {
  await removeById(req, res, next);
}

export default router;
