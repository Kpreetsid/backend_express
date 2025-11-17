import express from 'express';
import { getAll, getSop, create, update, remove } from './sops.controller';

export default (router: express.Router) => {
    const sopRouter = express.Router();
    sopRouter.get('/', getAll);
    sopRouter.get('/:id', getSop);
    sopRouter.post('/', create);
    sopRouter.put('/:id', update);
    sopRouter.delete('/:id', remove);
    router.use('/sops', sopRouter);
}