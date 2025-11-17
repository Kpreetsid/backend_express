import express from 'express';
import { getLocationsReport, createReport, deleteReport } from './location.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const locationReportRouter = express.Router();
    locationReportRouter.get('/', getLocationsReport);
    locationReportRouter.post('/', hasRolePermission('location', 'create_report'), createReport);
    locationReportRouter.delete('/:id', hasRolePermission('location', 'delete_report'), deleteReport);
    router.use('/locations', locationReportRouter);
}