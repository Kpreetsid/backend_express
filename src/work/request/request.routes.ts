import express from 'express';
import { requestController } from './request.controller';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.get('/', requestController.getAll);
    requestRouter.get('/:id', requestController.getById);
    requestRouter.post('/', requestController.create);
    requestRouter.put('/:id', requestController.update);
    requestRouter.patch('/approve/:id', requestController.approve);
    requestRouter.patch('/reject/:id', requestController.reject);
    requestRouter.patch('/:id/:status', requestController.update);
    requestRouter.patch('/:id', requestController.update);
    requestRouter.delete('/:id', requestController.remove);
    router.use('/requests', requestRouter);
}