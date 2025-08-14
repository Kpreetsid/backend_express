import express from 'express';
import { getAll, getById, create, update, remove } from './request.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.get('/', getAll);
    requestRouter.get('/:id', getById);
    requestRouter.post('/', create);
    requestRouter.put('/:id', update);
    requestRouter.patch('/reject/:id', update);
    requestRouter.delete('/:id', hasPermission('admin'), remove);
    router.use('/requests', requestRouter);
}