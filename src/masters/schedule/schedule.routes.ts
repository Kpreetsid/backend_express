import express from 'express';
import { getAll, getDataById, create, update, remove } from './schedule.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.get('/', getAll);
    scheduleRouter.get('/:id', getDataById);
    scheduleRouter.post('/', create);
    scheduleRouter.put('/:id', update);
    scheduleRouter.delete('/:id', hasPermission('admin'), remove);
    router.use('/schedulers', scheduleRouter);
}