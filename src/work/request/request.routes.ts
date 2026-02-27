import express from 'express';
import { requestController } from './request.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.get('/', requestController.getAll);
    requestRouter.get('/:id', validateParamId, requestController.getById);
    requestRouter.post('/', requestController.create);
    requestRouter.put('/:id', validateParamId, requestController.update);
    requestRouter.patch('/approve/:id', validateParamId, requestController.approve);
    requestRouter.patch('/reject/:id', validateParamId, requestController.reject);
    requestRouter.patch('/:id/:status', requestController.update);
    requestRouter.patch('/:id', validateParamId, requestController.update);
    requestRouter.delete('/:id', validateParamId, requestController.remove);
    router.use('/requests', requestRouter);
}