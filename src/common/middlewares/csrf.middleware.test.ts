import assert from 'node:assert/strict';
import test from 'node:test';
import { isCsrfExemptRequestPath } from './csrf.middleware';

test('only explicitly public endpoints bypass CMMS cookie CSRF protection', () => {
  for (const path of [
    '/api/users/login',
    '/api/users/external_auth',
    '/cmms_express/api/users/login',
    '/api/v1/users/login'
  ]) assert.equal(isCsrfExemptRequestPath(path), true, path);
});

test('query string injection and same-prefix routes cannot bypass CSRF', () => {
  for (const path of [
    '/api/work-orders?next=/api/users/login',
    '/api/users/logout?return=/api/users/login',
    '/api/users/login/impersonate',
    '/api/users/login-extra',
    '/api/work-orders/api/users/login?x=1',
    '/api/users/permissions?path=/api/users/external_auth'
  ]) assert.equal(isCsrfExemptRequestPath(path), false, path);
});
