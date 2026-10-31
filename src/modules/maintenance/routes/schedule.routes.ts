import express from 'express';
import { hasRolePermission } from '@common/middlewares/permission.middleware';
import { scheduleController } from '@modules/maintenance/controllers/schedule.controller';
import { validateParamId } from '@common/middlewares/validate.middleware';
import { scheduleValidator, scheduleUpdateValidator } from '@modules/maintenance/validators/schedule.validator';
import { validate } from '@common/middlewares/validator.middleware';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.use(hasRolePermission('preventive', 'view'));
    scheduleRouter.get('/', scheduleController.getAll);
    scheduleRouter.get('/:id', validateParamId, scheduleController.getDataById);
    scheduleRouter.post('/', hasRolePermission('preventive', 'add'), scheduleValidator, validate, scheduleController.create);
    scheduleRouter.put('/:id', validateParamId, hasRolePermission('preventive', 'edit'), scheduleValidator, validate, scheduleController.update);
    scheduleRouter.patch('/:id/status', validateParamId, hasRolePermission('preventive', 'edit'), scheduleUpdateValidator, validate, scheduleController.updateStatus);
    scheduleRouter.patch('/:id', validateParamId, hasRolePermission('preventive', 'edit'), scheduleUpdateValidator, validate, scheduleController.update);
    scheduleRouter.delete('/:id', validateParamId, hasRolePermission('preventive', 'delete'), scheduleController.remove);
    router.use('/schedulers', scheduleRouter);
}

