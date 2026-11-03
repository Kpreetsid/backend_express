import express from 'express';
import { locationReportController } from '@modules/reports/controllers/location.controller';
import { hasRolePermission } from '@common/middlewares';
import { validateParamId } from '@common/middlewares/validate.middleware';
import { getCmmsLocationData } from '@modules/reports/cmms-data/cmms-data.controller';

export default (router: express.Router) => {
    const locationReportRouter = express.Router();
    locationReportRouter.get('/', hasRolePermission('location', 'view'), locationReportController.getLocationsReport);
    locationReportRouter.post('/cmms-data', hasRolePermission('location', 'create_report'), getCmmsLocationData);
    locationReportRouter.post('/', hasRolePermission('location', 'create_report'), locationReportController.createReport);
    locationReportRouter.put('/:id', validateParamId, hasRolePermission('location', 'edit_report'), locationReportController.updateReport);
    locationReportRouter.patch('/:id', validateParamId, hasRolePermission('location', 'edit_report'), locationReportController.updateReport);
    locationReportRouter.delete('/:id', validateParamId, hasRolePermission('location', 'delete_report'), locationReportController.deleteReport);
    router.use('/locations', locationReportRouter);
}

