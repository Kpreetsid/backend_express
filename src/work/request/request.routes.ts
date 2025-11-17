import express from 'express';
import { getAll, getById, create, update, remove, approve, reject } from './request.controller';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.get('/', getAll);
    requestRouter.get('/:id', getById);
    requestRouter.post('/', create);
    requestRouter.put('/:id', update);
    requestRouter.patch('/approve/:id', approve);
    requestRouter.patch('/reject/:id', reject);
    requestRouter.patch('/:id/:status', update);
    requestRouter.delete('/:id', remove);
    router.use('/requests', requestRouter);
}