import express from 'express';
import { scheduleController } from './schedule.controller';
import { validateParamId } from '../../middlewares/validate';
import { scheduleValidator, scheduleUpdateValidator } from './schedule.validator';
import { validate } from '../../middlewares/validator.middleware';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.get('/', scheduleController.getAll);
    scheduleRouter.get('/:id', validateParamId, scheduleController.getDataById);
    scheduleRouter.post('/', scheduleValidator, validate, scheduleController.create);
    scheduleRouter.put('/:id', validateParamId, scheduleValidator, validate, scheduleController.update);
    scheduleRouter.patch('/:id/status', validateParamId, scheduleUpdateValidator, validate, scheduleController.updateStatus);
    scheduleRouter.patch('/:id', validateParamId, scheduleUpdateValidator, validate, scheduleController.update);
    scheduleRouter.delete('/:id', validateParamId, scheduleController.remove);
    router.use('/schedulers', scheduleRouter);
}