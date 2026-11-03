import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountModel } from './account.model';

test('new CMMS accounts default to enabled cookie authentication without altering encryption flags', () => {
  const account = new AccountModel({ account_name: 'New tenant', type: 'Industrial' });
  assert.equal(account.cookie_status, 'enabled');
  assert.equal(account.encrypt_payload, 'disabled');
  assert.equal(account.encrypt_response, 'disabled');
});

test('legacy disabled accounts remain readable during staged migration', () => {
  const account = new AccountModel({
    account_name: 'Legacy tenant',
    type: 'Industrial',
    cookie_status: 'disabled'
  });
  assert.equal(account.cookie_status, 'disabled');
});
