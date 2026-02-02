import express from 'express';
import { scheduleController } from './schedule.controller';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.get('/', scheduleController.getAll);
    scheduleRouter.get('/:id', scheduleController.getDataById);
    scheduleRouter.post('/', scheduleController.create);
    scheduleRouter.put('/:id', scheduleController.update);
    scheduleRouter.patch('/:id', scheduleController.update);
    scheduleRouter.delete('/:id', scheduleController.remove);
    router.use('/schedulers', scheduleRouter);
}