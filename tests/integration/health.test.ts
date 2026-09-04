import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

describe('Health & Root API Endpoints', () => {
  it('GET / should return 200 with welcome message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', true);
    expect(res.body).toHaveProperty('message', 'Welcome to CMMS ExpressJS API');
  });

  it('GET /health should return 200 with health status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('GET /non-existent-route should return 404', async () => {
    const res = await request(app).get('/api/v1/non-existent-endpoint-testing');
    expect(res.status).toBe(404);
  });
});
