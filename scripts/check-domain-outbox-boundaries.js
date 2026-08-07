const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const workOrderServicePath = path.join(
  repositoryRoot,
  'src',
  'work',
  'order',
  'order.service.ts'
);
const source = fs.readFileSync(workOrderServicePath, 'utf8');
const userControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'user', 'user.controller.ts'),
  'utf8'
);
const workRequestControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'work', 'request', 'request.controller.ts'),
  'utf8'
);
const normalizedWorkRequestControllerSource = workRequestControllerSource
  .replace(/\s+/g, ' ');
const workOrderAssigneeControllerSource = fs.readFileSync(
  path.join(
    repositoryRoot,
    'src',
    'transaction',
    'mapUserWorkOrder',
    'userWorkOrder.controller.ts'
  ),
  'utf8'
);
const inspectionControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'inspection', 'inspection.controller.ts'),
  'utf8'
);
const locationControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'location', 'location.controller.ts'),
  'utf8'
);
const observationControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'observation', 'observation.controller.ts'),
  'utf8'
);
const observationServiceSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'observation', 'observation.service.ts'),
  'utf8'
);
const observationProcessorHandlerSource = fs.readFileSync(
  path.join(
    repositoryRoot,
    'src',
    'queue',
    'handlers',
    'observation-asset-health.handler.ts'
  ),
  'utf8'
);
const assetControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'asset', 'asset.controller.ts'),
  'utf8'
);
const assetServiceSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'asset', 'asset.service.ts'),
  'utf8'
);
const equipmentControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'equipment', 'equipment.controller.ts'),
  'utf8'
);
const equipmentServiceSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'masters', 'equipment', 'equipment.service.ts'),
  'utf8'
);
const assetReportControllerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'reports', 'asset', 'asset.controller.ts'),
  'utf8'
);
const assetReportServiceSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'reports', 'asset', 'asset.service.ts'),
  'utf8'
);
const assetReportPdfJobServiceSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'reports', 'asset', 'asset-pdf-job.service.ts'),
  'utf8'
);
const assetReportPdfHandlerSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'queue', 'handlers', 'asset-report-pdf.handler.ts'),
  'utf8'
);
const assetReportPdfEventSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'queue', 'report-events.ts'),
  'utf8'
);
const assetReportRoutesSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'reports', 'asset', 'asset.routes.ts'),
  'utf8'
);

const requiredMarkers = [
  'async createWorkOrder(',
  'async updateById(',
  'notificationService.queueAccountNotification({',
  "type: 'email.work-order.assigned'",
  'dispatchWorkOrderAssignmentEmails(',
  'session,',
  '...(correlationId ? { correlationId } : {})'
];

const missing = requiredMarkers.filter((marker) => !source.includes(marker));
const directNotificationCount = (
  source.match(/notificationService\.notifyAccountUsers\(/g) || []
).length;
const unawaitedFanOutCount = (source.match(/\.forEach\(async\b/g) || []).length;
const requiredUserMarkers = [
  'const data = await withTransaction(async (session) => {',
  "type: 'email.user.created'",
  'notificationService.queueAccountNotification({',
  '}, { session, correlationId });',
  'if (!queueConfig.domainEventOutboxEnabled) {',
  'usersService.updateUserDetails(String(id), {',
  'notificationService.queueAccountNotification({',
  '}, { session, correlationId });'
];
const missingUserMarkers = requiredUserMarkers
  .filter((marker) => !userControllerSource.includes(marker));
const requiredWorkRequestMarkers = [
  'const data = await withTransaction(async (session) => {',
  'await withTransaction(async (session) => {',
  'queueWorkRequestNotification({',
  'notificationService.queueAccountNotification(payload, { session, correlationId });',
  'requestService.createRequest(body, user, session)',
  'requestService.updateRequest( String(id), account_id, body, user_id, session, expectedVersion',
  'requestService.markApproved( String(id), account_id, user_id, currentRequest.priority, session, expectedVersion',
  'requestService.markRejected( String(id), account_id, user_id, updatedRemarks, session, expectedVersion'
];
const missingWorkRequestMarkers = requiredWorkRequestMarkers
  .filter((marker) => !normalizedWorkRequestControllerSource.includes(marker));
const directWorkRequestNotificationCount = (
  workRequestControllerSource.match(/notificationService\.notifyAccountUsers\(/g) || []
).length;
const requiredWorkOrderAssigneeMarkers = [
  'await requireTenantWorkOrder(woId, account_id',
  'requireActiveTenantUsers(validatedUserIds, account_id, session)',
  'userWorkOrderService.mapUsersWorkOrder(mappings, session)',
  'userWorkOrderService.updateMappedUsers(woId, tenantUserIds, session)',
  'notificationService.queueAccountNotification({',
  '}, { session, correlationId });'
];
const missingWorkOrderAssigneeMarkers = requiredWorkOrderAssigneeMarkers
  .filter((marker) => !workOrderAssigneeControllerSource.includes(marker));
const directWorkOrderAssigneeNotificationCount = (
  workOrderAssigneeControllerSource.match(/notificationService\.notifyAccountUsers\(/g) || []
).length;
const requiredInspectionMarkers = [
  'inspectionService.createInspection(req.body, account_id, user_id, session)',
  'inspectionService.updateInspection(inspectionId, req.body, account_id, user_id, session)',
  'notificationService.queueAccountNotification({',
  '}, { session, correlationId });'
];
const requiredLocationMarkers = [
  'requireActiveTenantUsers(body.userIdList, account_id, session)',
  'locationService.insertLocation(',
  'locationService.updateById(',
  'notificationService.queueAccountNotification({',
  '}, { session, correlationId });'
];
const missingInspectionMarkers = requiredInspectionMarkers
  .filter((marker) => !inspectionControllerSource.includes(marker));
const missingLocationMarkers = requiredLocationMarkers
  .filter((marker) => !locationControllerSource.includes(marker));
const directInspectionNotificationCount = (
  inspectionControllerSource.match(/notificationService\.notifyAccountUsers\(/g) || []
).length;
const directLocationNotificationCount = (
  locationControllerSource.match(/notificationService\.notifyAccountUsers\(/g) || []
).length;
const requiredObservationMarkers = [
  'const result = await withTransaction(async (session) => {',
  'observationService.requireTenantReferences(body, account_id, session)',
  'observationService.updateObservationById(',
  'queueObservationAssetHealthSync({',
  'notificationService.queueAccountNotification({',
  '}, { session, correlationId });',
  'synchronizeObservationAssetHealth('
];
const requiredObservationServiceMarkers = [
  '{ _id: id, accountId: account_id, visible: true }',
  'new ObservationModel({',
  'accountId: account_id,',
  'userId: user_id,',
  'createdBy: user_id'
];
const requiredObservationHandlerMarkers = [
  "'processor.asset-health.observation-upserted'",
  'accountId: tenantId,',
  'externalAPI.token',
  '.select(\'assetId status alarmId\').lean()'
];
const missingObservationMarkers = requiredObservationMarkers
  .filter((marker) => !observationControllerSource.includes(marker));
const missingObservationServiceMarkers = requiredObservationServiceMarkers
  .filter((marker) => !observationServiceSource.includes(marker));
const missingObservationHandlerMarkers = requiredObservationHandlerMarkers
  .filter((marker) => !observationProcessorHandlerSource.includes(marker));
const directObservationNotificationCount = (
  observationControllerSource.match(/notificationService\.notifyAccountUsers\(/g) || []
).length;
const directObservationProcessorCount = (
  observationControllerSource.match(/processorAPIService\./g) || []
).length;
const observationUserTokenCount = (
  observationControllerSource.match(/\buserToken\b/g) || []
).length;
const manualObservationRollbackCount = (
  observationControllerSource.match(/deleteObservationById\(/g) || []
).length;
const requiredAssetMarkers = [
  'const result = await withTransaction(async (session) => {',
  'requireActiveTenantUsers(',
  'assetService.requireTenantReferences(tenantBody, account_id, session)',
  'assetService.createAssetOld(',
  'assetService.updateAssetOld(',
  'queueAssetHealthInitialization({',
  'notificationService.queueAccountNotification({',
  '}, { session, correlationId });'
];
const requiredAssetServiceMarkers = [
  '{ _id: id, account_id, visible: true }',
  'mapUserToAssetService.updateUserMapping(',
  'body.userIdList,',
  'session'
];
const missingAssetMarkers = requiredAssetMarkers
  .filter((marker) => !assetControllerSource.includes(marker));
const missingAssetServiceMarkers = requiredAssetServiceMarkers
  .filter((marker) => !assetServiceSource.includes(marker));
const directAssetNotificationCount = (
  assetControllerSource.match(/notificationService\.notifyAccountUsers\(/g) || []
).length;
const directAssetProcessorCount = (
  assetControllerSource.match(/processorAPIService\./g) || []
).length;
const directAssetServiceProcessorCount = (
  assetServiceSource.match(/processorAPIService\./g) || []
).length;
const assetUserTokenCount = (
  `${assetControllerSource}\n${assetServiceSource}`.match(/\buserToken\b/g) || []
).length;
const requiredAssetCopyMarkers = [
  'queueAssetEndpointClone({',
  'queueAssetHealthInitialization({',
  'synchronizeAssetEndpointClone(',
  'synchronizeAssetHealthInitialization(',
  'correlationId'
];
const missingAssetCopyMarkers = requiredAssetCopyMarkers
  .filter((marker) => !assetServiceSource.includes(marker));
const requiredEquipmentMarkers = [
  'requireActiveTenantUsers(',
  'equipmentService.requireTenantLocation(',
  'equipmentService.createEquipment(',
  'equipmentService.updateEquipment(Equipment, account_id, user_id, session)',
  'mapUserToAssetService.createMapUserAssets(assetsMapData, session)',
  'queueAssetHealthInitialization({',
  'queueEquipmentEndpointSync({',
  'notificationService.queueAccountNotification({',
  'equipmentService.updateEquipmentImageById(',
  '}, { session, correlationId });'
];
const requiredEquipmentServiceMarkers = [
  'requireTenantAssetForUpdate(',
  '{ _id: equipment.id, account_id, visible: true }',
  'session ? { session } : {}',
  'return assetService.makeAssetCopyRecursive('
];
const missingEquipmentMarkers = requiredEquipmentMarkers
  .filter((marker) => !equipmentControllerSource.includes(marker));
const missingEquipmentServiceMarkers = requiredEquipmentServiceMarkers
  .filter((marker) => !equipmentServiceSource.includes(marker));
const directEquipmentNotificationCount = (
  equipmentControllerSource.match(/notificationService\.notifyAccountUsers\(/g) || []
).length;
const directEquipmentProcessorCount = (
  `${equipmentControllerSource}\n${equipmentServiceSource}`
    .match(/processorAPIService\./g) || []
).length;
const equipmentUserTokenCount = (
  `${equipmentControllerSource}\n${equipmentServiceSource}`.match(/\buserToken\b/g) || []
).length;
const manualEquipmentRollbackCount = (
  equipmentControllerSource.match(
    /delete(?:AssetsById|EquipmentAssetIds|EquipmentEndpointByAssetId)\(/g
  ) || []
).length;
const requiredAssetReportMarkers = [
  'assetReportService.requireTenantReferences(',
  'assetReportService.createAssetReportWithWorkOrder(',
  'assetReportService.updateAssetReport(',
  'assetReportService.partialUpdateAssetReport(',
  'assetReportService.removeAssetReportById(',
  'queueAssetReportProcessorSync({',
  'observationService.updateObservation(',
  'accountId: user.account_id,',
  'externalAPI.token'
];
const requiredAssetReportServiceMarkers = [
  '{ _id: id, accountId: account_id, visible: true }',
  'orderService.createWorkOrder(',
  'correlationId,',
  'session'
];
const missingAssetReportMarkers = requiredAssetReportMarkers
  .filter((marker) => !assetReportControllerSource.includes(marker));
const missingAssetReportServiceMarkers = requiredAssetReportServiceMarkers
  .filter((marker) => !assetReportServiceSource.includes(marker));
const requiredAssetReportPdfMarkers = [
  'requestAssetReportPdf = async',
  'getAssetReportPdfJob = async',
  'getAssetReportPdfDownload = async',
  'queueAssetReportPdfGeneration({',
  "type: 'report.asset-pdf.generate'",
  "entity: {",
  "type: 'asset-report-pdf-job'",
  'assetReportPdfJobService.requireTenantJob(payload.jobId, envelope.tenantId)',
  'accountId: envelope.tenantId',
  'externalAPI.token',
  '`generated-reports/${envelope.tenantId}/${payload.jobId}`'
];
const missingAssetReportPdfMarkers = requiredAssetReportPdfMarkers.filter((marker) =>
  !`${assetReportControllerSource}\n${assetReportPdfJobServiceSource}\n${assetReportPdfHandlerSource}\n${assetReportPdfEventSource}`
    .includes(marker)
);
const requiredAssetReportPdfRouteMarkers = [
  "assetReportRouter.post('/generate-pdf/:id'",
  "'/generate-pdf-async/:id'",
  "assetReportRouter.get('/pdf-jobs/:jobId'",
  "assetReportRouter.get('/pdf-jobs/:jobId/download'"
];
const missingAssetReportPdfRouteMarkers = requiredAssetReportPdfRouteMarkers
  .filter((marker) => !assetReportRoutesSource.includes(marker));
const directAssetReportProcessorCount = (
  assetReportControllerSource.match(/processorAPIService\./g) || []
).length;
const assetReportUserTokenCount = (
  assetReportControllerSource.match(/\buserToken\b/g) || []
).length;
const manualAssetReportRollbackCount = (
  assetReportControllerSource.match(/deleteAssetReport\(/g) || []
).length;

if (
  missing.length > 0
  || missingUserMarkers.length > 0
  || missingWorkRequestMarkers.length > 0
  || missingWorkOrderAssigneeMarkers.length > 0
  || missingInspectionMarkers.length > 0
  || missingLocationMarkers.length > 0
  || missingObservationMarkers.length > 0
  || missingObservationServiceMarkers.length > 0
  || missingObservationHandlerMarkers.length > 0
  || missingAssetMarkers.length > 0
  || missingAssetServiceMarkers.length > 0
  || missingAssetCopyMarkers.length > 0
  || missingEquipmentMarkers.length > 0
  || missingEquipmentServiceMarkers.length > 0
  || missingAssetReportMarkers.length > 0
  || missingAssetReportServiceMarkers.length > 0
  || missingAssetReportPdfMarkers.length > 0
  || missingAssetReportPdfRouteMarkers.length > 0
  || directNotificationCount > 0
  || directWorkRequestNotificationCount > 0
  || directWorkOrderAssigneeNotificationCount > 0
  || directInspectionNotificationCount > 0
  || directLocationNotificationCount > 0
  || directObservationNotificationCount > 0
  || directObservationProcessorCount > 0
  || observationUserTokenCount > 0
  || manualObservationRollbackCount > 0
  || directAssetNotificationCount > 0
  || directAssetProcessorCount > 0
  || directAssetServiceProcessorCount > 0
  || assetUserTokenCount > 0
  || directEquipmentNotificationCount > 0
  || directEquipmentProcessorCount > 0
  || equipmentUserTokenCount > 0
  || manualEquipmentRollbackCount > 0
  || directAssetReportProcessorCount > 0
  || assetReportUserTokenCount > 0
  || manualAssetReportRollbackCount > 0
  || unawaitedFanOutCount > 0
) {
  if (missing.length > 0) {
    console.error(`Work-order outbox markers missing: ${missing.join(', ')}`);
  }
  if (directNotificationCount > 0) {
    console.error(
      `Work-order service contains ${directNotificationCount} direct account notification call(s)`
    );
  }
  if (unawaitedFanOutCount > 0) {
    console.error(
      `Work-order service contains ${unawaitedFanOutCount} unawaited async fan-out loop(s)`
    );
  }
  if (missingUserMarkers.length > 0) {
    console.error(`User-create outbox markers missing: ${missingUserMarkers.join(', ')}`);
  }
  if (missingWorkRequestMarkers.length > 0) {
    console.error(`Work-request outbox markers missing: ${missingWorkRequestMarkers.join(', ')}`);
  }
  if (directWorkRequestNotificationCount > 0) {
    console.error(
      `Work-request controller contains ${directWorkRequestNotificationCount} direct account notification call(s)`
    );
  }
  if (missingWorkOrderAssigneeMarkers.length > 0) {
    console.error(
      `Work-order assignee outbox markers missing: ${missingWorkOrderAssigneeMarkers.join(', ')}`
    );
  }
  if (directWorkOrderAssigneeNotificationCount > 0) {
    console.error(
      `Work-order assignee controller contains ${directWorkOrderAssigneeNotificationCount} direct account notification call(s)`
    );
  }
  if (missingInspectionMarkers.length > 0) {
    console.error(`Inspection outbox markers missing: ${missingInspectionMarkers.join(', ')}`);
  }
  if (missingLocationMarkers.length > 0) {
    console.error(`Location outbox markers missing: ${missingLocationMarkers.join(', ')}`);
  }
  if (directInspectionNotificationCount > 0) {
    console.error(`Inspection controller contains ${directInspectionNotificationCount} direct notification call(s)`);
  }
  if (directLocationNotificationCount > 0) {
    console.error(`Location controller contains ${directLocationNotificationCount} direct notification call(s)`);
  }
  if (missingObservationMarkers.length > 0) {
    console.error(`Observation outbox markers missing: ${missingObservationMarkers.join(', ')}`);
  }
  if (missingObservationServiceMarkers.length > 0) {
    console.error(
      `Observation tenant-write markers missing: ${missingObservationServiceMarkers.join(', ')}`
    );
  }
  if (missingObservationHandlerMarkers.length > 0) {
    console.error(
      `Observation processor-handler markers missing: ${missingObservationHandlerMarkers.join(', ')}`
    );
  }
  if (directObservationNotificationCount > 0) {
    console.error(
      `Observation controller contains ${directObservationNotificationCount} direct notification call(s)`
    );
  }
  if (directObservationProcessorCount > 0) {
    console.error(
      `Observation controller contains ${directObservationProcessorCount} direct processor call(s)`
    );
  }
  if (observationUserTokenCount > 0) {
    console.error('Observation controller still reads or persists a user token');
  }
  if (manualObservationRollbackCount > 0) {
    console.error('Observation controller still contains a manual delete rollback');
  }
  if (missingAssetMarkers.length > 0) {
    console.error(`Asset outbox markers missing: ${missingAssetMarkers.join(', ')}`);
  }
  if (missingAssetServiceMarkers.length > 0) {
    console.error(`Asset tenant-write markers missing: ${missingAssetServiceMarkers.join(', ')}`);
  }
  if (directAssetNotificationCount > 0) {
    console.error(`Asset controller contains ${directAssetNotificationCount} direct notification call(s)`);
  }
  if (directAssetProcessorCount > 0) {
    console.error(`Asset controller contains ${directAssetProcessorCount} direct processor call(s)`);
  }
  if (directAssetServiceProcessorCount > 0) {
    console.error(`Asset service contains ${directAssetServiceProcessorCount} direct processor call(s)`);
  }
  if (assetUserTokenCount > 0) {
    console.error('Asset mutation/copy code still reads or forwards a user token');
  }
  if (missingAssetCopyMarkers.length > 0) {
    console.error(`Asset-copy outbox markers missing: ${missingAssetCopyMarkers.join(', ')}`);
  }
  if (missingEquipmentMarkers.length > 0) {
    console.error(`Equipment outbox markers missing: ${missingEquipmentMarkers.join(', ')}`);
  }
  if (missingEquipmentServiceMarkers.length > 0) {
    console.error(
      `Equipment tenant-write markers missing: ${missingEquipmentServiceMarkers.join(', ')}`
    );
  }
  if (directEquipmentNotificationCount > 0) {
    console.error(
      `Equipment controller contains ${directEquipmentNotificationCount} direct notification call(s)`
    );
  }
  if (directEquipmentProcessorCount > 0) {
    console.error(
      `Equipment mutation/copy code contains ${directEquipmentProcessorCount} direct processor call(s)`
    );
  }
  if (equipmentUserTokenCount > 0) {
    console.error('Equipment mutation/copy code still reads or forwards a user token');
  }
  if (manualEquipmentRollbackCount > 0) {
    console.error('Equipment controller still contains a manual delete rollback');
  }
  if (missingAssetReportMarkers.length > 0) {
    console.error(`Asset-report outbox markers missing: ${missingAssetReportMarkers.join(', ')}`);
  }
  if (missingAssetReportServiceMarkers.length > 0) {
    console.error(
      `Asset-report tenant-write markers missing: ${missingAssetReportServiceMarkers.join(', ')}`
    );
  }
  if (missingAssetReportPdfMarkers.length > 0) {
    console.error(
      `Asset-report PDF queue markers missing: ${missingAssetReportPdfMarkers.join(', ')}`
    );
  }
  if (missingAssetReportPdfRouteMarkers.length > 0) {
    console.error(
      `Asset-report PDF compatibility/additive routes missing: ${missingAssetReportPdfRouteMarkers.join(', ')}`
    );
  }
  if (directAssetReportProcessorCount > 0) {
    console.error(
      `Asset-report controller contains ${directAssetReportProcessorCount} direct processor call(s)`
    );
  }
  if (assetReportUserTokenCount > 0) {
    console.error('Asset-report controller still reads or forwards a user token');
  }
  if (manualAssetReportRollbackCount > 0) {
    console.error('Asset-report controller still contains a manual delete rollback');
  }
  process.exit(1);
}

console.log(
  'Domain outbox boundary verified (work-order, assignee, work-request, inspection, location, asset/equipment/report processor sync, asynchronous report PDF generation, observation processor sync, and user notifications/email are transaction-aware).'
);
