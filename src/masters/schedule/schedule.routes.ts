import express from 'express';
import { getSchedules, getSchedule, createSchedule, updateSchedule, removeSchedule } from './schedule.controller';

export default (router: express.Router) => {
    router.get('/schedules', getSchedules);
    router.get('/schedule/:id', getSchedule);
    router.post('/schedule', createSchedule);
    router.put('/schedule/:id', updateSchedule);
    router.delete('/schedule/:id', removeSchedule);
}