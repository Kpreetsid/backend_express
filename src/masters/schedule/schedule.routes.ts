import express from 'express';
import { getSchedules, getSchedule, getFilterSchedules, createSchedule, updateSchedule, removeSchedule } from './schedule.controller';

export default (router: express.Router) => {
    const scheduleRouter = express.Router();
    scheduleRouter.get('/', getSchedules);
    scheduleRouter.get('/filter', getFilterSchedules);
    scheduleRouter.get('/:id', getSchedule);
    scheduleRouter.post('/', createSchedule);
    scheduleRouter.put('/:id', updateSchedule);
    scheduleRouter.delete('/:id', removeSchedule);
    router.use('/schedules', scheduleRouter);
}