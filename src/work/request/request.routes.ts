import express from 'express';
import { getAll, getById, create, update, remove, approve, reject } from './request.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.get('/', getAll);
    requestRouter.get('/:id', getById);
    requestRouter.post('/', create);
    requestRouter.put('/:id', update);
    requestRouter.patch('/:id/:status', update);
    requestRouter.patch('/:id/approve', hasPermission('admin'), approve);
    requestRouter.patch('/:id/reject', reject);
    requestRouter.delete('/:id', hasPermission('admin'), remove);
    router.use('/requests', requestRouter);
}