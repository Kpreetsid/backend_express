import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '../configDB';
import { companyService } from '../masters/company/company.service';
import { rolesService } from '../masters/user/role/roles.service';
import { usersService } from '../masters/user/user.service';
import { TokenModel } from '../models/userToken.model';
import {
  decodedAccessToken,
  decryptToken,
  encryptToken,
  generateAccessToken,
  generateExternalAccessToken,
  isAuthenticated,
  isLogOutAuthenticated,
  verifyEncryptedToken,
  verifyExternalAccessToken
} from './auth';

const userId = '507f191e810c19729de860ea';
const accountId = '507f191e810c19729de860eb';
const otherAccountId = '507f191e810c19729de860ec';
const username = 'tenant-user';

const generateTenantToken = () => generateAccessToken({
  id: userId,
  username,
  companyID: accountId
});

function errorHandler(
  error: Error & { status?: number },
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) {
  res.status(error.status || 500).json({
    status: false,
    message: error.message,
    name: error.name
  });
}

function createBoundaryApp(
  path: string,
  middleware: express.RequestHandler,
  response: (req: express.Request, res: express.Response) => void
) {
  const app = express();
  app.use(express.json());
  app.all(path, middleware, response);
  app.use(errorHandler);
  return app;
}

const logoutApp = createBoundaryApp(
  '/logout-boundary',
  isLogOutAuthenticated,
  (req, res) => res.status(200).json({
    userId: (req as any).user_id,
    userToken: (req as any).userToken
  })
);

const authenticatedApp = createBoundaryApp(
  '/authenticated-boundary',
  isAuthenticated,
  (req, res) => res.status(200).json({
    user: (req as any).user,
    companyID: (req as any).companyID,
    role: (req as any).role,
    userToken: (req as any).userToken
  })
);

const encryptedTokenApp = createBoundaryApp(
  '/encrypted-boundary',
  verifyEncryptedToken,
  (_req, res) => res.sendStatus(204)
);

function mockSuccessfulAuthentication() {
  vi.spyOn(TokenModel, 'findOne').mockResolvedValue({
    _id: 'stored-access-token'
  } as never);
  vi.spyOn(companyService, 'verifyCompany').mockResolvedValue({
    _id: accountId
  } as never);
  vi.spyOn(usersService, 'verifyUserLogin').mockResolvedValue({
    toObject: () => ({ _id: userId, username, account_id: accountId })
  } as never);
  vi.spyOn(rolesService, 'verifyUserRole').mockResolvedValue({
    account_id: accountId,
    toObject: () => ({ data: { work_orders: { read: true } } })
  } as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('access-token helpers', () => {
  it('generates unique, verifiable access tokens with the configured claims', () => {
    const first = generateTenantToken();
    const second = generateTenantToken();

    expect(first).not.toBe(second);
    const decoded = decodedAccessToken(first);
    expect(decoded).toMatchObject({
      id: userId,
      username,
      companyID: accountId,
      iss: auth.issuer,
      aud: auth.audience
    });
    expect(decoded.jti).toEqual(expect.any(String));
  });

  it('verifies external JWTs only with the external secret and claims', () => {
    const externalToken = jwt.sign(
      { id: userId, companyID: accountId },
      auth.external_secret,
      {
        expiresIn: 60,
        algorithm: auth.algorithm as jwt.Algorithm,
        issuer: auth.issuer,
        audience: auth.audience
      }
    );

    expect(verifyExternalAccessToken(externalToken)).toMatchObject({
      id: userId,
      companyID: accountId
    });
    expect(() => verifyExternalAccessToken(generateTenantToken())).toThrow();
  });
});

describe('authenticated tenant boundary', () => {
  beforeEach(() => {
    mockSuccessfulAuthentication();
  });

  it('attaches verified user, company, role, and token context', async () => {
    const token = generateTenantToken();
    const response = await request(authenticatedApp)
      .get('/authenticated-boundary')
      .set('Authorization', `Bearer ${token}`)
      .set('accountID', accountId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { _id: userId, username, account_id: accountId },
      companyID: accountId,
      role: { work_orders: { read: true } },
      userToken: token
    });
  });

  it('rejects missing authentication context', async () => {
    const response = await request(authenticatedApp)
      .get('/authenticated-boundary');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Unauthorized access');
    expect(TokenModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects an access token absent from the token store', async () => {
    vi.mocked(TokenModel.findOne).mockResolvedValueOnce(null);

    const response = await request(authenticatedApp)
      .get('/authenticated-boundary')
      .set('Authorization', `Bearer ${generateTenantToken()}`)
      .set('accountID', accountId);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid token');
  });

  it('rejects a cross-tenant account header before company lookup', async () => {
    const response = await request(authenticatedApp)
      .get('/authenticated-boundary')
      .set('Authorization', `Bearer ${generateTenantToken()}`)
      .set('accountID', otherAccountId);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid token');
    expect(companyService.verifyCompany).not.toHaveBeenCalled();
  });

  it('rejects an unknown company', async () => {
    vi.mocked(companyService.verifyCompany).mockResolvedValueOnce(null);

    const response = await request(authenticatedApp)
      .get('/authenticated-boundary')
      .set('Authorization', `Bearer ${generateTenantToken()}`)
      .set('accountID', accountId);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Account ID is invalid');
  });

  it('rejects a missing user', async () => {
    vi.mocked(usersService.verifyUserLogin).mockResolvedValueOnce(null);

    const response = await request(authenticatedApp)
      .get('/authenticated-boundary')
      .set('Authorization', `Bearer ${generateTenantToken()}`)
      .set('accountID', accountId);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });

  it('rejects a missing user role', async () => {
    vi.mocked(rolesService.verifyUserRole).mockResolvedValueOnce(null);

    const response = await request(authenticatedApp)
      .get('/authenticated-boundary')
      .set('Authorization', `Bearer ${generateTenantToken()}`)
      .set('accountID', accountId);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('User role not found');
  });

  it('rejects a role owned by another company', async () => {
    vi.mocked(rolesService.verifyUserRole).mockResolvedValueOnce({
      account_id: otherAccountId,
      toObject: () => ({ data: {} })
    } as never);

    const response = await request(authenticatedApp)
      .get('/authenticated-boundary')
      .set('Authorization', `Bearer ${generateTenantToken()}`)
      .set('accountID', accountId);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('User does not belong to the company');
  });
});

describe('logout tenant boundary', () => {
  it('accepts a matching token and account header', async () => {
    const token = generateTenantToken();
    const response = await request(logoutApp)
      .get('/logout-boundary')
      .set('Authorization', `Bearer ${token}`)
      .set('accountID', accountId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId, userToken: token });
  });

  it('rejects a missing token or account header', async () => {
    const response = await request(logoutApp)
      .get('/logout-boundary')
      .set('Authorization', `Bearer ${generateTenantToken()}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Unauthorized access');
  });

  it('rejects a cross-tenant account header', async () => {
    const response = await request(logoutApp)
      .get('/logout-boundary')
      .set('Authorization', `Bearer ${generateTenantToken()}`)
      .set('accountID', otherAccountId);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid token');
  });
});

describe('encrypted external-token boundary', () => {
  it('round-trips email and generic encrypted payload tokens', () => {
    const emailToken = encryptToken('engineer@example.com', 60);
    expect(decryptToken(emailToken)).toMatchObject({
      email: 'engineer@example.com'
    });

    const payload = { id: userId, companyID: accountId };
    const externalToken = generateExternalAccessToken(payload, 60);
    expect(decryptToken(externalToken)).toMatchObject(payload);
  });

  it('accepts a valid encrypted token', async () => {
    const response = await request(encryptedTokenApp)
      .post('/encrypted-boundary')
      .send({ external_token: encryptToken('engineer@example.com', 60) });

    expect(response.status).toBe(204);
  });

  it('rejects a missing, expired, or corrupted encrypted token', async () => {
    const missing = await request(encryptedTokenApp)
      .post('/encrypted-boundary')
      .send({});
    const expired = await request(encryptedTokenApp)
      .post('/encrypted-boundary')
      .send({ external_token: encryptToken('engineer@example.com', -1) });
    const corrupted = await request(encryptedTokenApp)
      .post('/encrypted-boundary')
      .send({ external_token: 'not-a-valid-token' });

    expect(missing.status).toBe(401);
    expect(missing.body.message).toBe('Token missing in body');
    expect(expired.status).toBe(401);
    expect(expired.body.message).toBe('Token expired');
    expect(corrupted.status).toBe(401);
    expect(corrupted.body).toMatchObject({
      message: 'Invalid or corrupted external token',
      name: 'InvalidTokenError'
    });
  });
});
