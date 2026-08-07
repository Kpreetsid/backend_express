import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import app from '../app';
import { generateAccessToken } from '../_config/auth';
import { TokenModel } from '../models/userToken.model';

const protectedResourceFamilies = [
  ['users', '/api/master/users'],
  ['roles', '/api/master/roles'],
  ['companies', '/api/master/companies'],
  ['locations', '/api/master/locations'],
  ['assets', '/api/master/assets'],
  ['inspections', '/api/master/inspections'],
  ['parts', '/api/master/parts'],
  ['schedules', '/api/master/schedulers'],
  ['standard operating procedures', '/api/master/sops'],
  ['procedures', '/api/work/procedures'],
  ['work requests', '/api/work/requests'],
  ['work orders', '/api/work/orders'],
  ['reports', '/api/reports/assets'],
  ['notifications', '/api/notifications'],
  ['uploads', '/api/upload']
] as const;

describe('protected resource-family boundary', () => {
  it.each(protectedResourceFamilies)(
    'denies an anonymous request to %s',
    async (_resource, endpoint) => {
      const response = await request(app).get(endpoint);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ status: false });
    }
  );

  it.each(protectedResourceFamilies)(
    'denies a cross-tenant account header for %s',
    async (_resource, endpoint) => {
      const token = generateAccessToken({
        id: '507f191e810c19729de860ea',
        username: 'tenant-a-user',
        companyID: '507f191e810c19729de860eb'
      });
      const tokenLookup = vi.spyOn(TokenModel, 'findOne').mockResolvedValue({
        _id: token
      } as never);

      try {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`)
          .set('accountID', '507f191e810c19729de860ec');

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ status: false });
      } finally {
        tokenLookup.mockRestore();
      }
    }
  );
});
