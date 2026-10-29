import express from 'express';
import { hasRolePermission } from '../../../common/middlewares/permission.middleware';
import { requestController } from '../controllers/request.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { workRequestValidator } from '../validators/workRequest.validator';
import { validate } from '../../../common/middlewares/validator.middleware';
import { idempotencyMiddleware } from '../../../common/middlewares/idempotency.middleware';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.use(idempotencyMiddleware);
    requestRouter.use(hasRolePermission('work_request', 'view'));
    requestRouter.get('/', requestController.getAll);
    requestRouter.get('/:id', validateParamId, requestController.getById);
    requestRouter.post('/', hasRolePermission('work_request', 'add'), workRequestValidator, validate, requestController.create);
    requestRouter.put('/:id', validateParamId, hasRolePermission('work_request', 'edit'), workRequestValidator, validate, requestController.update);
    requestRouter.patch('/approve/:id', validateParamId, hasRolePermission('work_request_status', 'edit'), requestController.approve);
    requestRouter.patch('/reject/:id', validateParamId, hasRolePermission('work_request_status', 'edit'), requestController.reject);
    requestRouter.patch('/:id/:status', hasRolePermission('work_request_status', 'edit'), requestController.update);
    requestRouter.patch('/:id', validateParamId, hasRolePermission('work_request', 'edit'), workRequestValidator, validate, requestController.update);
    requestRouter.delete('/:id', validateParamId, hasRolePermission('work_request', 'delete'), requestController.remove);
    router.use('/requests', requestRouter);
}

