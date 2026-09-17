const assert = require('node:assert/strict');

const lifecycle = require('../dist/reports/asset/diagnostic-lifecycle.js');
const { ReportAssetModel } = require('../dist/models/assetReport.model.js');

assert.equal(
  lifecycle.resolveCreationDiagnosticLifecycle('1', [{ name: 'Misalignment', value: 3 }]),
  'ACTIVE'
);
assert.equal(
  lifecycle.resolveCreationDiagnosticLifecycle('2', [{ name: 'Misalignment', value: 3 }]),
  'HISTORICAL'
);
assert.throws(
  () => lifecycle.resolveCreationDiagnosticLifecycle('2', [], 'ACTIVE'),
  /requires FaultDetected=Yes/
);
assert.equal(
  lifecycle.assertDiagnosticLifecycleTransition({
    currentLifecycle: 'ACTIVE',
    nextLifecycle: 'MONITORING',
    resultingFaultDetected: '1',
    resultingFaultData: [{ name: 'Misalignment', value: 2 }]
  }),
  'MONITORING'
);
assert.equal(
  lifecycle.assertDiagnosticLifecycleTransition({
    currentLifecycle: 'ACTIVE',
    nextLifecycle: 'RESOLVED',
    resultingFaultDetected: '1',
    resultingFaultData: [{ name: 'Misalignment', value: 3 }]
  }),
  'RESOLVED'
);
assert.throws(
  () => lifecycle.assertDiagnosticLifecycleTransition({
    currentLifecycle: 'SUPERSEDED',
    nextLifecycle: 'ACTIVE',
    resultingFaultDetected: '1',
    resultingFaultData: [{ name: 'Misalignment', value: 3 }]
  }),
  /not allowed/
);
assert.throws(
  () => lifecycle.assertDiagnosticLifecycleTransition({
    currentLifecycle: 'HISTORICAL',
    nextLifecycle: 'ACTIVE',
    resultingFaultDetected: '2',
    resultingFaultData: []
  }),
  /requires FaultDetected=Yes/
);

const diagnosticLifecyclePath = ReportAssetModel.schema.path('diagnosticLifecycle');
assert.ok(diagnosticLifecyclePath, 'diagnosticLifecycle schema path must exist');
assert.deepEqual(
  diagnosticLifecyclePath.options.enum,
  lifecycle.DIAGNOSTIC_LIFECYCLES,
  'schema and lifecycle contract must use the same enum'
);
assert.ok(ReportAssetModel.schema.path('diagnosticLifecycleUpdatedAt'));
assert.ok(ReportAssetModel.schema.path('diagnosticLifecycleUpdatedBy'));
assert.ok(ReportAssetModel.schema.path('resolvedAt'));

console.log('diagnostic_lifecycle_regression=PASS');
console.log('diagnostic_lifecycle_schema=PASS');
