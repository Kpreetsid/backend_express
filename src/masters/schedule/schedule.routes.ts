import express from 'express';
import { scheduleController } from './schedule.controller';
import { validateParamId } from '../../middlewares/validate';
import { scheduleValidator, scheduleUpdateValidator } from './schedule.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasRolePermission } from '../../middlewares/permission';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.get('/', hasRolePermission('preventive', 'view'), scheduleController.getAll);
    scheduleRouter.get('/:id', validateParamId, hasRolePermission('preventive', 'view'), scheduleController.getDataById);
    scheduleRouter.post('/', hasRolePermission('preventive', 'add'), scheduleValidator, validate, scheduleController.create);
    scheduleRouter.put('/:id', validateParamId, hasRolePermission('preventive', 'edit'), scheduleValidator, validate, scheduleController.update);
    scheduleRouter.patch('/:id/status', validateParamId, hasRolePermission('preventive', 'edit'), scheduleUpdateValidator, validate, scheduleController.updateStatus);
    scheduleRouter.patch('/:id', validateParamId, hasRolePermission('preventive', 'edit'), scheduleUpdateValidator, validate, scheduleController.update);
    scheduleRouter.delete('/:id', validateParamId, hasRolePermission('preventive', 'delete'), scheduleController.remove);
    router.use('/schedulers', scheduleRouter);
}
