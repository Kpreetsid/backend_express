import express from 'express';
import { getSchedules, getSchedule, createSchedule, updateSchedule, removeSchedule } from './schedule.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.get('/', getSchedules);
    scheduleRouter.get('/:id', getSchedule);
    scheduleRouter.post('/', createSchedule);
    scheduleRouter.put('/:id', updateSchedule);
    scheduleRouter.delete('/:id', hasPermission('admin'),removeSchedule);
    router.use('/schedules', scheduleRouter);
}