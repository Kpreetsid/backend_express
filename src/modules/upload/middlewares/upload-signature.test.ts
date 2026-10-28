import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedUploadSignature } from './upload-signature';

test('accepts matching PNG JPEG and PDF signatures', () => {
  assert.equal(isAllowedUploadSignature(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), '.png'), true);
  assert.equal(isAllowedUploadSignature(Buffer.from([0xff,0xd8,0xff,0xe0]), '.jpg'), true);
  assert.equal(isAllowedUploadSignature(Buffer.from('%PDF-1.7'), '.pdf'), true);
});

test('rejects extension/signature mismatches and executable text', () => {
  assert.equal(isAllowedUploadSignature(Buffer.from('%PDF-1.7'), '.png'), false);
  assert.equal(isAllowedUploadSignature(Buffer.from('MZ executable'), '.pdf'), false);
  assert.equal(isAllowedUploadSignature(Buffer.from('<script>alert(1)</script>'), '.jpg'), false);
});
