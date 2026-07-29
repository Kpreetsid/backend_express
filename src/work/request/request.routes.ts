import express from 'express';
import { requestController } from './request.controller';
import { validateParamId } from '../../middlewares/validate';
import { workRequestValidator } from './workRequest.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.use(idempotencyMiddleware);
    requestRouter.get('/', requestController.getAll);
    requestRouter.get('/:id', validateParamId, requestController.getById);
    requestRouter.post('/', hasAccountFeature('work_request', 'add'), workRequestValidator, validate, requestController.create);
    requestRouter.put('/:id', hasAccountFeature('work_request', 'edit'), validateParamId, workRequestValidator, validate, requestController.update);
    requestRouter.patch('/approve/:id', hasAccountFeature('work_request_status', 'edit'), validateParamId, requestController.approve);
    requestRouter.patch('/reject/:id', hasAccountFeature('work_request_status', 'edit'), validateParamId, requestController.reject);
    requestRouter.patch('/:id/:status', hasAccountFeature('work_request_status', 'edit'), requestController.update);
    requestRouter.patch('/:id', hasAccountFeature('work_request', 'edit'), validateParamId, workRequestValidator, validate, requestController.update);
    requestRouter.delete('/:id', hasAccountFeature('work_request', 'delete'), validateParamId, requestController.remove);
    router.use('/requests', requestRouter);
}
