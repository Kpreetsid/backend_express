import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const expectAll = (file: string, snippets: string[]) => {
  const source = read(file);
  for (const snippet of snippets) {
    assert.ok(source.includes(snippet), `${file} must contain: ${snippet}`);
  }
};

test('asset and location routes enforce view plus mutation permissions', () => {
  expectAll('src/modules/assets/routes/asset.routes.ts', [
    "assetRouter.use(hasRolePermission('asset', 'view'))",
    "hasRolePermission('asset', 'edit_asset'), assetController.setBuzzerAssetList",
  ]);
  expectAll('src/modules/assets/routes/equipment.routes.ts', [
    "equipmentRouter.use(hasRolePermission('asset', 'view'))"
  ]);
  expectAll('src/modules/assets/routes/observation.routes.ts', [
    "observationRouter.use(hasRolePermission('asset', 'view'))",
    "hasRolePermission('asset', 'edit_observation'), observationValidator",
    "hasRolePermission('asset', 'delete_observation'), observationController.removeObservation"
  ]);
  expectAll('src/modules/locations/routes/location.routes.ts', [
    "locationRouter.use(hasRolePermission('location', 'view'))",
    "hasRolePermission('location', 'add_location'), locationController.createDuplicateLocation",
    "hasRolePermission('location', 'edit_location'), locationController.updateLocationFloorMapImage"
  ]);
});

test('maintenance and library routes enforce module actions', () => {
  expectAll('src/modules/maintenance/routes/formCategory.routes.ts', [
    "formCategoryRouter.use(hasRolePermission('form_category', 'view'))",
    "hasRolePermission('form_category', 'add')",
    "hasRolePermission('form_category', 'edit')",
    "hasRolePermission('form_category', 'delete')"
  ]);
  expectAll('src/modules/maintenance/routes/schedule.routes.ts', [
    "scheduleRouter.use(hasRolePermission('preventive', 'view'))",
    "hasRolePermission('preventive', 'add')",
    "hasRolePermission('preventive', 'edit')",
    "hasRolePermission('preventive', 'delete')"
  ]);
  expectAll('src/modules/maintenance/routes/sops.routes.ts', [
    "sopRouter.use(hasRolePermission('form', 'view'))",
    "hasRolePermission('form', 'add')",
    "hasRolePermission('form', 'edit')",
    "hasRolePermission('form', 'delete')"
  ]);
  expectAll('src/modules/maintenance/routes/troubleshoot-guide.routes.ts', [
    "troubleshootGuideRouter.use(hasRolePermission('procedures', 'view'))",
    "hasRolePermission('procedures', 'add')",
    "hasRolePermission('procedures', 'edit')",
    "hasRolePermission('procedures', 'delete')"
  ]);
  expectAll('src/modules/maintenance/routes/inspection.routes.ts', [
    "inspectionRouter.use(hasRolePermission('inspections', 'view'))",
    "hasRolePermission('inspections', 'add')",
    "hasRolePermission('inspections', 'edit')",
    "hasRolePermission('inspections', 'delete')",
    "hasRolePermission('workOrder', 'create_work_order')"
  ]);
  expectAll('src/modules/work-orders/routes/instruction.routes.ts', [
    "instructionRouter.use(hasRolePermission('procedures', 'view'))",
    "hasRolePermission('procedures', 'add')",
    "hasRolePermission('procedures', 'edit')",
    "hasRolePermission('procedures', 'delete')"
  ]);
  expectAll('src/modules/work-orders/routes/procedure.routes.ts', [
    "procedureRouter.use(hasRolePermission('procedures', 'view'))",
    "hasRolePermission('procedures', 'add')",
    "hasRolePermission('procedures', 'edit')",
    "hasRolePermission('procedures', 'delete')"
  ]);
  expectAll('src/modules/work-orders/routes/orderTemplate.routes.ts', [
    "orderTemplateRouter.use(hasRolePermission('work_order_templates', 'view'))",
    "hasRolePermission('work_order_templates', 'add')",
    "hasRolePermission('work_order_templates', 'edit')",
    "hasRolePermission('work_order_templates', 'delete')"
  ]);
});

test('work order and request routes enforce mutation and workflow actions', () => {
  expectAll('src/modules/work-orders/routes/order.routes.ts', [
    "orderRouter.use(hasRolePermission('workOrder', 'view'))",
    "hasRolePermission('workOrder', 'edit_work_order'), updateWorkOrderValidator",
    "orderRouter.post('/:id/attachments', validateParamId, hasRolePermission('workOrder', 'edit_work_order')"
  ]);
  expectAll('src/modules/work-orders/routes/comment.routes.ts', [
    "router.use(hasRolePermission('workOrder', 'view'))",
    "hasRolePermission('workOrder', 'add_comment_work_order')",
    "hasRolePermission('workOrder', 'edit_comment_work_order')",
    "hasRolePermission('workOrder', 'delete_comment_work_order')"
  ]);
  expectAll('src/modules/work-orders/routes/request.routes.ts', [
    "requestRouter.use(hasRolePermission('work_request', 'view'))",
    "hasRolePermission('work_request', 'add')",
    "hasRolePermission('work_request', 'edit')",
    "hasRolePermission('work_request_status', 'edit')",
    "hasRolePermission('work_request', 'delete')"
  ]);
});

test('inventory, posts and mappings enforce action permissions', () => {
  expectAll('src/modules/inventory/routes/parts.routes.ts', [
    "partRouter.use(hasRolePermission('inventory', 'view'))",
    "hasRolePermission('inventory', 'import')",
    "hasRolePermission('inventory', 'add')",
    "hasRolePermission('inventory', 'edit')",
    "hasRolePermission('inventory', 'delete')"
  ]);
  expectAll('src/modules/inventory/routes/parts-type.routes.ts', [
    "partTypeRouter.use(hasRolePermission('inventory', 'view'))",
    "hasRolePermission('inventory', 'add')",
    "hasRolePermission('inventory', 'edit')",
    "hasRolePermission('inventory', 'delete')"
  ]);
  expectAll('src/modules/communications/routes/posts.routes.ts', [
    "postRouter.use(hasRolePermission('posts', 'view'))",
    "hasRolePermission('posts', 'add')",
    "hasRolePermission('posts', 'edit')",
    "hasRolePermission('posts', 'delete')"
  ]);
  expectAll('src/modules/communications/routes/comments.routes.ts', [
    "router.use(hasRolePermission('posts', 'view'))",
    "hasRolePermission('posts', 'add')",
    "hasRolePermission('posts', 'edit')",
    "hasRolePermission('posts', 'delete')"
  ]);
  expectAll('src/modules/mappings/routes/userAsset.routes.ts', [
    "router.get('/userToAssets', hasRolePermission('users', 'view')",
    "hasRolePermission('users', 'edit')"
  ]);
  expectAll('src/modules/mappings/routes/userLocation.routes.ts', [
    "router.get('/userToLocations', hasRolePermission('users', 'view')",
    "hasRolePermission('users', 'edit')"
  ]);
  expectAll('src/modules/mappings/routes/userWorkOrder.routes.ts', [
    "workOrderRouter.use(hasRolePermission('workOrder', 'view'))",
    "hasRolePermission('workOrder', 'edit_work_order')"
  ]);
});

test('company lifecycle routes enforce tenant-level authorization', () => {
  expectAll('src/modules/company/routes/company.routes.ts', [
    "companyRouter.post('/', requireFirstUser",
    "hasRolePermission('admin_panel', 'edit'), companyValidator",
    "hasRolePermission('admin_panel', 'edit'), companyController.updateImageCompany",
    "companyRouter.delete('/:id', validateParamId, requireFirstUser"
  ]);
  expectAll('src/modules/company/controllers/company.controller.ts', [
    "if (String(account_id) !== id)",
    "Invalid account ID"
  ]);
});

test('admin settings, logs and reports use matching action keys', () => {
  expectAll('src/modules/settings/routes/analysisFeature.routes.ts', [
    "analysisFeatureRouter.use(hasRolePermission('admin_panel', 'view'))",
    "hasRolePermission('admin_panel', 'edit')"
  ]);
  expectAll('src/modules/users/routes/logs.routes.ts', [
    "userLogRouter.use(hasRolePermission('users', 'view'))"
  ]);
  expectAll('src/modules/reports/routes/location.routes.ts', [
    "hasRolePermission('location', 'edit_report'), locationReportController.updateReport"
  ]);
});


test('floor map coordinate and detail routes enforce floor-map actions', () => {
  expectAll('src/modules/locations/routes/floorMap.routes.ts', [
    "floorMapRouter.get('/coordinate', hasRolePermission('floorMap', 'view_floor_map')",
    "floorMapRouter.post('/coordinate', hasRolePermission('floorMap', 'upload_floor_map')",
    "floorMapRouter.get('/coordinate/asset/:id', validateParamId, hasRolePermission('floorMap', 'view_floor_map')",
    "floorMapRouter.get('/:id', validateParamId, hasRolePermission('floorMap', 'view_floor_map')",
    "floorMapRouter.delete('/coordinate/:id', validateParamId, hasRolePermission('floorMap', 'delete_kpi')"
  ]);
});
