import express from 'express';
import { locationReportController } from './location.controller';
import { hasAccountFeature, hasRolePermission } from '../../middlewares';
import { validateParamId } from '../../middlewares/validate';

export default (router: express.Router) => {
    const locationReportRouter = express.Router();
    locationReportRouter.get('/', locationReportController.getLocationsReport);
    locationReportRouter.post('/', hasAccountFeature('location_report', 'add'), hasRolePermission('location', 'create_report'), locationReportController.createReport);
    locationReportRouter.put('/:id', hasAccountFeature('location_report', 'edit'), validateParamId, hasRolePermission('location', 'create_report'), locationReportController.updateReport);
    locationReportRouter.patch('/:id', hasAccountFeature('location_report', 'edit'), validateParamId, hasRolePermission('location', 'create_report'), locationReportController.updateReport);
    locationReportRouter.delete('/:id', hasAccountFeature('location_report', 'delete'), validateParamId, hasRolePermission('location', 'delete_report'), locationReportController.deleteReport);
    router.use('/locations', locationReportRouter);
}
