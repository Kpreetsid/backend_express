import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAssetReportScope, buildLocationReportScope } from './report-scope';

test('asset report export/update scope always carries tenant and visibility', () => {
  assert.deepEqual(
    buildAssetReportScope('account-1', 'report-1'),
    { accountId: 'account-1', visible: true, _id: 'report-1' }
  );
  assert.deepEqual(
    buildAssetReportScope('account-1', undefined, { status: 'Open' }),
    { accountId: 'account-1', visible: true, status: 'Open' }
  );
});

test('location report scope uses the location-report tenant field', () => {
  assert.deepEqual(
    buildLocationReportScope('account-1', 'report-1'),
    { account_id: 'account-1', visible: true, _id: 'report-1' }
  );
});
