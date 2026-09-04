import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

describe('Modular Enterprise API Routing', () => {
  describe('Crypto & Internal Routing', () => {
    it('GET /api/v1/crypto/bootstrap should return 200 with payload crypto info', async () => {
      const res = await request(app).get('/api/v1/crypto/bootstrap');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('message');
    });

    it('GET /cmms_express/api/v1/crypto/bootstrap should support base path prefix', async () => {
      const res = await request(app).get('/cmms_express/api/v1/crypto/bootstrap');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
    });
  });

  describe('Public Auth Route Boundaries', () => {
    it('POST /api/v1/users/login with empty body should fail with 400', async () => {
      const res = await request(app)
        .post('/api/v1/users/login')
        .send({});
      expect([400, 422]).toContain(res.status);
    });

    it('POST /api/v1/registration/verifyOTP with missing body should fail with 400', async () => {
      const res = await request(app)
        .post('/api/v1/registration/verifyOTP')
        .send({});
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Protected Route Authentication Barriers', () => {
    it('GET /api/v1/master/users without auth token should reject with 401', async () => {
      const res = await request(app).get('/api/v1/master/users');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/work/order without auth token should reject with 401', async () => {
      const res = await request(app).get('/api/v1/work/order');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/reports/asset without auth token should reject with 401', async () => {
      const res = await request(app).get('/api/v1/reports/asset');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/map/user without auth token should reject with 401', async () => {
      const res = await request(app).get('/api/v1/map/user');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/notifications without auth token should reject with 401', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });
  });
});
