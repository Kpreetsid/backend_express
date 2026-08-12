import express from 'express';
import { scheduleController } from './schedule.controller';
import { validateParamId } from '../../middlewares/validate';
import { scheduleValidator, scheduleUpdateValidator } from './schedule.validator';
import { validate } from '../../middlewares/validator.middleware';
import { hasAccountFeature } from '../../middlewares/permission';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.get('/', scheduleController.getAll);
    scheduleRouter.get('/:id', validateParamId, scheduleController.getDataById);
    scheduleRouter.post('/', hasAccountFeature('preventive', 'add'), scheduleValidator, validate, scheduleController.create);
    scheduleRouter.put('/:id', hasAccountFeature('preventive', 'edit'), validateParamId, scheduleValidator, validate, scheduleController.update);
    scheduleRouter.patch('/:id/status', validateParamId, scheduleUpdateValidator, validate, scheduleController.updateStatus);
    scheduleRouter.patch('/:id', hasAccountFeature('preventive', 'edit'), validateParamId, scheduleUpdateValidator, validate, scheduleController.update);
    scheduleRouter.delete('/:id', hasAccountFeature('preventive', 'delete'), validateParamId, scheduleController.remove);
    router.use('/schedulers', scheduleRouter);
}
