import assert from 'node:assert/strict';
import test from 'node:test';
import { isStaticFileOwnedByAccount } from './static-file-scope';

test('static file ownership requires the authenticated account marker', () => {
  assert.equal(
    isStaticFileOwnedByAccount('assets/20261028-assets-507f1f77bcf86cd799439011-acde1234.png', '507f1f77bcf86cd799439011'),
    true
  );
  assert.equal(
    isStaticFileOwnedByAccount('assets/20261028-assets-aaaaaaaaaaaaaaaaaaaaaaaa-acde1234.png', '507f1f77bcf86cd799439011'),
    false
  );
});

test('unscoped legacy filenames fail closed', () => {
  assert.equal(isStaticFileOwnedByAccount('assets/legacy-image.png', '507f1f77bcf86cd799439011'), false);
  assert.equal(isStaticFileOwnedByAccount('../secret.txt', '507f1f77bcf86cd799439011'), false);
});
