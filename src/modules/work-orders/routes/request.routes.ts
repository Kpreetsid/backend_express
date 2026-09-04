import express from 'express';
import { requestController } from '../controllers/request.controller';
import { validateParamId } from '../../../common/middlewares/validate.middleware';
import { workRequestValidator } from '../validators/workRequest.validator';
import { validate } from '../../../common/middlewares/validate.middleware';

import { hasRolePermission } from '../../../common/middlewares/permission.middleware';

export default (router: express.Router) => {
    const requestRouter = express.Router();
    requestRouter.get('/', hasRolePermission('work_request', 'view'), requestController.getAll);
    requestRouter.get('/:id', validateParamId, hasRolePermission('work_request', 'view'), requestController.getById);
    requestRouter.post('/', hasRolePermission('work_request', 'add'), workRequestValidator, validate, requestController.create);
    requestRouter.put('/:id', validateParamId, hasRolePermission('work_request', 'edit'), workRequestValidator, validate, requestController.update);
    requestRouter.patch('/approve/:id', validateParamId, hasRolePermission('work_request', 'edit'), requestController.approve);
    requestRouter.patch('/reject/:id', validateParamId, hasRolePermission('work_request', 'edit'), requestController.reject);
    requestRouter.patch('/:id/:status', validateParamId, hasRolePermission('work_request', 'edit'), requestController.update);
    requestRouter.patch('/:id', validateParamId, hasRolePermission('work_request', 'edit'), workRequestValidator, validate, requestController.update);
    requestRouter.delete('/:id', validateParamId, hasRolePermission('work_request', 'delete'), requestController.remove);
    router.use('/requests', requestRouter);
}

