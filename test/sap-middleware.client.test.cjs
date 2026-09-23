const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  loadSapMiddlewareConfig,
  mapWorkOrderToSap,
  SapMiddlewareClient
} = require('../dist/integrations/sapMiddleware.client');

const apiKey = 'backend-to-middleware-test-key-00000001';

function config(overrides = {}) {
  return {
    enabled: true,
    baseUrl: 'http://127.0.0.1:3010',
    createPath: '/api/v1/master/sap/records',
    apiKey,
    timeoutMs: 15000,
    defaultOrderType: 'PM01',
    defaultMaintenancePlant: '1000',
    ...overrides
  };
}

const workOrder = {
  _id: '68c7f66906af86cb16982e0d',
  order_no: 'WO-20260042',
  title: 'Inspect pump seals',
  description: 'Created in CMMS',
  priority: 'High',
  status: 'In-Progress',
  asset: { asset_id: 'EQ-0042' }
};

test('SAP middleware integration is disabled by default', async () => {
  const loaded = loadSapMiddlewareConfig({});
  assert.equal(loaded.enabled, false);
  const client = new SapMiddlewareClient(loaded, async () => { throw new Error('must not call'); });
  assert.deepEqual(await client.createWorkOrder(workOrder), { status: 'disabled', operation: 'create' });
  assert.deepEqual(await client.updateWorkOrder(workOrder), { status: 'disabled', operation: 'update' });
  assert.deepEqual(await client.deleteWorkOrder(workOrder), { status: 'disabled', operation: 'delete' });
});

test('work order is mapped into the SAP maintenance order contract', () => {
  assert.deepEqual(mapWorkOrderToSap(workOrder, {}, config()), {
    MaintenanceOrder: '20260042',
    MaintenanceOrderDesc: 'Inspect pump seals',
    Description: 'Created in CMMS',
    Priority: 'High',
    SystemStatus: 'In Progress',
    OrderType: 'PM01',
    MaintenancePlant: '1000',
    Equipment: 'EQ-0042'
  });
  const mapped = mapWorkOrderToSap(workOrder, { Equipment: 'SAP-EQ-99', SystemStatus: 'Blocked' }, config());
  assert.equal(mapped.Equipment, 'SAP-EQ-99');
  assert.equal(mapped.SystemStatus, 'Blocked');
});

test('backend sends a stable idempotency key and returns the middleware acknowledgement', async () => {
  let request;
  const client = new SapMiddlewareClient(config(), async incoming => {
    request = incoming;
    return { status: 201, data: { idempotencyKey: incoming.headers['Idempotency-Key'], sapStatus: 201,
      record: { d: { MaintenanceOrder: '20260042' } } } };
  });
  const acknowledgement = await client.createWorkOrder(workOrder, {}, {
    cmmsAccountId: '6993082af0c0a565b983aa65',
    cmmsUserId: '69f9ebc2cb48abdb7909085e'
  });
  assert.equal(request.url, 'http://127.0.0.1:3010/api/v1/master/sap/records');
  assert.equal(request.headers['X-API-Key'], apiKey);
  assert.equal(request.headers['Idempotency-Key'], `work-order-${workOrder._id}`);
  assert.equal(request.data.MaintenanceOrder, '20260042');
  assert.equal(request.data.cmmsAccountId, '6993082af0c0a565b983aa65');
  assert.equal(request.data.cmmsUserId, '69f9ebc2cb48abdb7909085e');
  assert.deepEqual(acknowledgement, {
    status: 'acknowledged',
    operation: 'create',
    idempotencyKey: `work-order-${workOrder._id}`,
    sapStatus: 201,
    record: { d: { MaintenanceOrder: '20260042' } }
  });
});

test('middleware rejection is returned as a safe failure acknowledgement', async () => {
  const client = new SapMiddlewareClient(config(), async () => {
    throw { response: { status: 409, data: { error: { message: 'Order already exists' } } } };
  });
  assert.deepEqual(await client.createWorkOrder(workOrder), {
    status: 'failed',
    operation: 'create',
    code: 'SAP_MIDDLEWARE_FAILED',
    message: 'Order already exists',
    middlewareStatus: 409
  });
});

test('middleware identity errors are not mislabeled as SAP response statuses', async () => {
  const client = new SapMiddlewareClient(config(), async () => {
    throw { response: { status: 404, data: { error: {
      code: 'SAP_USER_MAPPING_NOT_FOUND',
      message: 'No active SAP user mapping found for the supplied outbound identity'
    } } } };
  });

  assert.deepEqual(await client.createWorkOrder(workOrder), {
    status: 'failed',
    operation: 'create',
    code: 'SAP_MIDDLEWARE_FAILED',
    message: 'No active SAP user mapping found for the supplied outbound identity',
    middlewareStatus: 404
  });
});

test('backend sends PATCH and DELETE to the stable SAP record identity', async () => {
  const requests = [];
  const client = new SapMiddlewareClient(config(), async incoming => {
    requests.push(incoming);
    return { status: 200, data: { operation: incoming.method === 'PATCH' ? 'update' : 'delete',
      idempotencyKey: incoming.headers['Idempotency-Key'], sapStatus: incoming.method === 'DELETE' ? 204 : 200,
      record: null } };
  });
  const update = await client.updateWorkOrder({ ...workOrder, title: 'Updated pump inspection', status: 'Completed' });
  const remove = await client.deleteWorkOrder(workOrder);
  assert.equal(requests[0].method, 'PATCH');
  assert.equal(requests[0].url, 'http://127.0.0.1:3010/api/v1/master/sap/records/20260042');
  assert.equal(requests[0].data.MaintenanceOrder, undefined);
  assert.equal(requests[0].data.MaintenanceOrderDesc, 'Updated pump inspection');
  assert.equal(requests[0].data.SystemStatus, 'Completed');
  assert.match(requests[0].headers['Idempotency-Key'], /^work-order-.+-update-/);
  assert.equal(requests[1].method, 'DELETE');
  assert.equal(requests[1].url, 'http://127.0.0.1:3010/api/v1/master/sap/records/20260042');
  assert.equal(requests[1].data, undefined);
  assert.match(requests[1].headers['Idempotency-Key'], /^work-order-.+-delete-/);
  assert.equal(update.operation, 'update');
  assert.equal(remove.operation, 'delete');
});

test('an update backfills a legacy work order when SAP reports it missing', async () => {
  const requests = [];
  const client = new SapMiddlewareClient(config(), async incoming => {
    requests.push(incoming);
    if (incoming.method === 'PATCH') {
      throw { response: { status: 422, data: { error: {
        code: 'SAP_UPDATE_FAILED', message: 'Order not found', sapStatus: 404
      } } } };
    }
    return { status: 201, data: { operation: 'create', idempotencyKey: incoming.headers['Idempotency-Key'],
      sapStatus: 201, record: { d: { MaintenanceOrder: '20260042' } } } };
  });

  const result = await client.updateWorkOrder(workOrder);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].method, 'PATCH');
  assert.equal(requests[1].method, 'POST');
  assert.equal(requests[1].url, 'http://127.0.0.1:3010/api/v1/master/sap/records');
  assert.equal(requests[1].data.MaintenanceOrder, '20260042');
  assert.match(requests[1].headers['Idempotency-Key'], /^work-order-.+-backfill-/);
  assert.equal(result.status, 'acknowledged');
  assert.equal(result.operation, 'update');
  assert.equal(result.sapStatus, 201);
  assert.equal(result.recovery, 'backfilled');
});

test('delete treats an SAP record that is already absent as acknowledged', async () => {
  const client = new SapMiddlewareClient(config(), async () => {
    throw { response: { status: 422, data: { error: {
      code: 'SAP_DELETE_FAILED', message: 'Order not found', sapStatus: 404
    } } } };
  });

  const result = await client.deleteWorkOrder(workOrder);
  assert.equal(result.status, 'acknowledged');
  assert.equal(result.operation, 'delete');
  assert.equal(result.sapStatus, 404);
  assert.equal(result.recovery, 'already-absent');
});
