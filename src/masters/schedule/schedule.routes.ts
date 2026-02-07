import express from 'express';
import { scheduleController } from './schedule.controller';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.get('/', scheduleController.getAll);
    scheduleRouter.get('/:id', validateParamId, scheduleController.getDataById);
    scheduleRouter.post('/', scheduleController.create);
    scheduleRouter.put('/:id', validateParamId, scheduleController.update);
    scheduleRouter.patch('/:id', validateParamId, scheduleController.update);
    scheduleRouter.delete('/:id', validateParamId, scheduleController.remove);
    router.use('/schedulers', scheduleRouter);
}