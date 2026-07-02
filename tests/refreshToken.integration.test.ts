import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import mongoose from 'mongoose';
import { authentication, refreshAccessToken } from '../src/user/authentication/authentication.controller';
import { isAuthenticated } from '../src/_config/auth';
import { TokenModel } from '../src/models/userToken.model';
import { UserModel } from '../src/models/user.model';
import { passwordService } from '../src/utils/bcrypt';
import { companyService } from '../src/masters/company/company.service';
import { rolesService } from '../src/masters/user/role/roles.service';
import { mapUserToLocationService } from '../src/transaction/mapUserLocation/userLocation.service';
import { usersService } from '../src/masters/user/user.service';
import { refreshTokenService, __refreshTokenTestUtils } from '../src/user/authentication/refreshToken.service';

const userId = new mongoose.Types.ObjectId();
const accountId = new mongoose.Types.ObjectId();
const user = {
  _id: userId,
  id: userId,
  username: 'admin',
  email: 'admin@example.com',
  password: 'hashed-password',
  account_id: accountId,
  user_role: 'admin',
  user_status: 'active',
  isVerified: true,
  toObject: () => ({
    _id: userId,
    username: 'admin',
    email: 'admin@example.com',
    account_id: accountId,
    user_role: 'admin',
    password: 'hidden'
  })
} as any;

const role = {
  account_id: { toString: () => String(accountId) },
  data: { assets: true },
  roleMenu: [{ name: 'Assets' }],
  toObject: () => ({ data: { assets: true }, roleMenu: [{ name: 'Assets' }], account_id: accountId })
};

const buildApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.post('/api/users/login', authentication);
  app.post('/api/auth/refresh', refreshAccessToken);
  app.get('/api/protected', isAuthenticated, (_req, res) => {
    res.status(200).json({ status: true, data: 'protected' });
  });
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status || 500).json({ status: false, message: err.message });
  });
  return app;
};

describe('refresh token auth flow', () => {
  const savedRefreshTokens: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    savedRefreshTokens.length = 0;

    jest.spyOn(passwordService, 'comparePassword').mockResolvedValue(true);
    jest.spyOn(UserModel, 'findOne').mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(user)
    } as any));
    jest.spyOn(companyService, 'getAllCompanies').mockResolvedValue([{ _id: accountId, account_name: 'Test Account', experience_profile: 'standard_account' }] as any);
    jest.spyOn(companyService, 'verifyCompany').mockResolvedValue({ _id: accountId } as any);
    jest.spyOn(rolesService, 'verifyUserRole').mockResolvedValue(role as any);
    jest.spyOn(rolesService, 'createUserRole').mockResolvedValue(role as any);
    jest.spyOn(mapUserToLocationService, 'getLocationsMappedData').mockResolvedValue([{ locationId: new mongoose.Types.ObjectId() }] as any);
    jest.spyOn(usersService, 'verifyUserLogin').mockResolvedValue({
      ...user,
      toObject: () => user.toObject()
    });
    jest.spyOn(TokenModel, 'findOne').mockImplementation((filter: any) => {
      if (filter?.principalType === __refreshTokenTestUtils.REFRESH_PRINCIPAL_TYPE) {
        return {
          exec: jest.fn().mockResolvedValue(savedRefreshTokens.find((token) => token._id === filter._id) || null)
        } as any;
      }
      return { exec: jest.fn().mockResolvedValue({ _id: filter?._id || 'stored-access-token' }) } as any;
    });
    jest.spyOn(TokenModel.prototype as any, 'save').mockImplementation(function save() {
      if (this.principalType === __refreshTokenTestUtils.REFRESH_PRINCIPAL_TYPE && !savedRefreshTokens.includes(this)) {
        savedRefreshTokens.push(this);
      }
      return Promise.resolve(this);
    });
  });

  it('logs in, stores a refresh cookie, refreshes the access token, and accesses a protected route', async () => {
    const agent = request.agent(buildApp());

    const loginResponse = await agent
      .post('/api/users/login')
      .send({ username: 'admin', password: 'password' })
      .expect(200);

    expect(loginResponse.body.data.token).toBeTruthy();
    expect(loginResponse.headers['set-cookie']?.join(';')).toContain(refreshTokenService.cookieName);
    expect(savedRefreshTokens.length).toBe(1);
    const refreshCookie = String(loginResponse.headers['set-cookie']?.[0] || '').split(';')[0];

    const refreshResponse = await agent
      .post('/api/auth/refresh')
      .set(__refreshTokenTestUtils.REFRESH_HEADER, 'true')
      .set('Cookie', refreshCookie)
      .send({})
      .expect(200);

    expect(refreshResponse.body.data.token).toBeTruthy();
    expect(refreshResponse.body.data.token).not.toBe(loginResponse.body.data.token);
    expect(savedRefreshTokens[0].revokedAt).toEqual(expect.any(Date));

    await agent
      .get('/api/protected')
      .set('Authorization', `Bearer ${refreshResponse.body.data.token}`)
      .set('accountid', String(accountId))
      .expect(200, { status: true, data: 'protected' });
  });

  it('rejects an expired refresh token', async () => {
    const rawRefreshToken = 'expired-refresh-token';
    savedRefreshTokens.push({
      _id: __refreshTokenTestUtils.hashRefreshToken(rawRefreshToken),
      principalType: __refreshTokenTestUtils.REFRESH_PRINCIPAL_TYPE,
      userId,
      account_id: accountId,
      expiresAt: new Date(Date.now() - 1000),
      save: jest.fn().mockResolvedValue(undefined)
    });

    await request(buildApp())
      .post('/api/auth/refresh')
      .set('Cookie', `${refreshTokenService.cookieName}=${rawRefreshToken}`)
      .set(__refreshTokenTestUtils.REFRESH_HEADER, 'true')
      .send({})
      .expect(401);
  });
});
