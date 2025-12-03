import express from 'express';
import { getAssets, getAsset, getFilteredAssets, getChildAsset, getAssetTree, removeAsset, create, createOld, updateOld, updateAssetImage, update, getAssetSensorList, makeAssetCopy, getBuzzerAssetList, setBuzzerAssetList } from './equipment.controller';
import { hasRolePermission } from '../../middlewares';

export default (router: express.Router) => {
    const equipmentRouter = express.Router();
    equipmentRouter.get('/buzzer', getBuzzerAssetList);
    equipmentRouter.patch('/buzzer/:location_id', setBuzzerAssetList);
    equipmentRouter.get('/', getAssets);
    equipmentRouter.get('/sensor-list', getAssetSensorList);
    equipmentRouter.get('/tree', getAssetTree);
    equipmentRouter.get('/tree/:id', getAssetTree);
    equipmentRouter.get('/child/:id', getChildAsset);
    equipmentRouter.get('/make-copy/:id', hasRolePermission('asset', 'add_asset'), makeAssetCopy);
    equipmentRouter.get('/:id', getAsset);
    equipmentRouter.post('/', hasRolePermission('asset', 'add_asset'), create);
    equipmentRouter.post('/old', hasRolePermission('asset', 'add_asset'), createOld);
    equipmentRouter.put('/old-edit/:id', hasRolePermission('asset', 'edit_asset'), updateOld);
    equipmentRouter.post('/tree', getAssetTree);
    equipmentRouter.post('/filter', getFilteredAssets);
    equipmentRouter.put('/:id', hasRolePermission('asset', 'edit_asset'), update);
    equipmentRouter.patch('/:id', hasRolePermission('asset', 'edit_asset'), updateAssetImage);
    equipmentRouter.delete('/:id', hasRolePermission('asset', 'delete_asset'), removeAsset);
    router.use('/equipment', equipmentRouter);
}