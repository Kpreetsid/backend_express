import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { refreshTokenService, __refreshTokenTestUtils } from '../src/user/authentication/refreshToken.service';
import { TokenModel } from '../src/models/userToken.model';
import { UserModel } from '../src/models/user.model';
import { companyService } from '../src/masters/company/company.service';
import { rolesService } from '../src/masters/user/role/roles.service';

jest.mock('../src/_config/auth', () => ({
  generateAccessToken: jest.fn(() => 'new-access-token')
}));

const buildResponse = (): Response => ({
  cookie: jest.fn(),
  clearCookie: jest.fn()
}) as unknown as Response;

const buildUser = () => {
  const userId = new mongoose.Types.ObjectId();
  const accountId = new mongoose.Types.ObjectId();
  return {
    _id: userId,
    id: userId,
    username: 'admin',
    email: 'admin@example.com',
    account_id: accountId,
    user_role: 'admin',
    toObject: () => ({
      _id: userId,
      username: 'admin',
      email: 'admin@example.com',
      account_id: accountId,
      user_role: 'admin',
      password: 'hidden'
    })
  } as any;
};

describe('refreshTokenService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues an opaque HTTP-only refresh cookie and stores only the hash', async () => {
    const req = { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1', socket: {} } as Request;
    const res = buildResponse();
    const user = buildUser();
    const savedTokens: any[] = [];
    jest.spyOn(TokenModel.prototype as any, 'save').mockImplementation(function save() {
      savedTokens.push(this);
      return Promise.resolve(this);
    });

    await refreshTokenService.issueForUser(req, res, user);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    const [cookieName, rawToken, options] = (res.cookie as jest.Mock).mock.calls[0];
    expect(cookieName).toBe(refreshTokenService.cookieName);
    expect(typeof rawToken).toBe('string');
    expect(options.httpOnly).toBe(true);
    expect(savedTokens[0]._id).toBe(__refreshTokenTestUtils.hashRefreshToken(rawToken));
    expect(savedTokens[0]._id).not.toBe(rawToken);
    expect(savedTokens[0].principalType).toBe(__refreshTokenTestUtils.REFRESH_PRINCIPAL_TYPE);
  });

  it('rejects refresh calls without the CSRF-resistant refresh header', async () => {
    await expect(refreshTokenService.refreshAccessToken({ headers: {}, body: {}, cookies: {} } as any, buildResponse()))
      .rejects.toMatchObject({ status: 403 });
  });

  it('rejects missing refresh tokens and clears the cookie', async () => {
    const res = buildResponse();
    await expect(refreshTokenService.refreshAccessToken({
      headers: { [refreshTokenService.refreshHeader]: 'true' },
      body: {},
      cookies: {}
    } as any, res)).rejects.toMatchObject({ status: 401 });
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and issues a new access token', async () => {
    const user = buildUser();
    const rawRefreshToken = 'valid-refresh-token';
    const storedRefreshToken = {
      _id: __refreshTokenTestUtils.hashRefreshToken(rawRefreshToken),
      principalType: __refreshTokenTestUtils.REFRESH_PRINCIPAL_TYPE,
      userId: user._id,
      account_id: user.account_id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: undefined,
      save: jest.fn().mockResolvedValue(undefined)
    };
    const req = {
      headers: { [refreshTokenService.refreshHeader]: 'true', 'user-agent': 'jest' },
      body: {},
      cookies: { [refreshTokenService.cookieName]: rawRefreshToken },
      ip: '127.0.0.1',
      socket: {}
    } as any;
    const res = buildResponse();

    jest.spyOn(TokenModel, 'findOne').mockReturnValue({ exec: jest.fn().mockResolvedValue(storedRefreshToken) } as any);
    jest.spyOn(TokenModel.prototype as any, 'save').mockResolvedValue(undefined);
    jest.spyOn(UserModel, 'findOne').mockReturnValue({ select: jest.fn().mockResolvedValue(user) } as any);
    jest.spyOn(companyService, 'getAllCompanies').mockResolvedValue([{ _id: user.account_id, account_name: 'Test Account' }] as any);
    jest.spyOn(rolesService, 'verifyUserRole').mockResolvedValue({ data: { assets: true }, roleMenu: [{ name: 'Assets' }] } as any);

    const data = await refreshTokenService.refreshAccessToken(req, res);

    expect(data.token).toBe('new-access-token');
    expect(data.userDetails.password).toBeUndefined();
    expect(storedRefreshToken.revokedAt).toEqual(expect.any(Date));
    expect(storedRefreshToken.save).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(refreshTokenService.cookieName, expect.any(String), expect.objectContaining({ httpOnly: true }));
  });
});
