import express from 'express';
import { locationReportController } from './location.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const locationReportRouter = express.Router();
    locationReportRouter.get('/', locationReportController.getLocationsReport);
    locationReportRouter.post('/', hasRolePermission('location', 'create_report'), locationReportController.createReport);
    locationReportRouter.put('/:id', hasRolePermission('location', 'create_report'), locationReportController.updateReport);
    locationReportRouter.patch('/:id', hasRolePermission('location', 'create_report'), locationReportController.updateReport);
    locationReportRouter.delete('/:id', hasRolePermission('location', 'delete_report'), locationReportController.deleteReport);
    router.use('/locations', locationReportRouter);
}