import express from 'express';
import { requestController } from './request.controller';
import { validateParamId } from '../../middlewares/validate';
import { workRequestValidator } from './workRequest.validator';
import { validate } from '../../middlewares/validator.middleware';
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.use(idempotencyMiddleware);
    requestRouter.get('/', requestController.getAll);
    requestRouter.get('/:id', validateParamId, requestController.getById);
    requestRouter.post('/', workRequestValidator, validate, requestController.create);
    requestRouter.put('/:id', validateParamId, workRequestValidator, validate, requestController.update);
    requestRouter.patch('/approve/:id', validateParamId, requestController.approve);
    requestRouter.patch('/reject/:id', validateParamId, requestController.reject);
    requestRouter.patch('/:id/:status', requestController.update);
    requestRouter.patch('/:id', validateParamId, workRequestValidator, validate, requestController.update);
    requestRouter.delete('/:id', validateParamId, requestController.remove);
    router.use('/requests', requestRouter);
}
