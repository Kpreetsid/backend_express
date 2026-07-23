import crypto from 'crypto';
import mongoose from 'mongoose';
import { auth, refreshToken as refreshTokenConfig } from '../../configDB';
import { generateAccessToken } from '../../_config/auth';
import { getAccessTokenTypeFilter, TokenModel } from '../../models/userToken.model';
import { IUser, UserLoginPayload, UserModel } from '../../models/user.model';
import { companyService } from '../../masters/company/company.service';
import { parseTtlSeconds } from '../../utils/ttl';

interface IssuedAccessSession {
  token: string;
  token_id: mongoose.Types.ObjectId;
}

const hashRefreshToken = (token: string): string => crypto
  .createHmac('sha256', refreshTokenConfig.secret)
  .update(token)
  .digest('hex');

const createRawRefreshToken = (): string => crypto.randomBytes(64).toString('base64url');

class RefreshTokenService {
  async issue(user: IUser): Promise<string> {
    const rawToken = createRawRefreshToken();
    await TokenModel.create({
      _id: hashRefreshToken(rawToken),
      tokenType: 'refresh',
      userId: user._id,
      accountId: user.account_id,
      expiresAt: new Date(Date.now() + parseTtlSeconds(
        refreshTokenConfig.expiresIn,
        7 * 24 * 60 * 60
      ) * 1000)
    });
    return rawToken;
  }

  async rotate(rawToken: string): Promise<{ token: string; token_id: mongoose.Types.ObjectId; refreshToken: string }> {
    if (!rawToken) {
      throw Object.assign(new Error('Refresh token missing'), { status: 401 });
    }

    const tokenHash = hashRefreshToken(rawToken);
    const stored = await TokenModel.findOneAndUpdate(
      {
        _id: tokenHash,
        tokenType: 'refresh',
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() }
      },
      { $set: { revokedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!stored) {
      throw Object.assign(new Error('Refresh token invalid, expired, or already used'), { status: 401 });
    }

    if (!stored.accountId) {
      throw Object.assign(new Error('Refresh token account is missing'), { status: 401 });
    }

    const user = await UserModel.findOne({
      _id: stored.userId,
      account_id: stored.accountId,
      user_status: 'active'
    });
    if (!user) {
      throw Object.assign(new Error('User session is no longer valid'), { status: 401 });
    }

    const account = await companyService.verifyCompany(String(stored.accountId));
    if (!account) {
      throw Object.assign(new Error('Account is no longer valid'), { status: 401 });
    }

    let access: IssuedAccessSession | null = null;
    let replacement: string | null = null;
    try {
      access = await this.createAccessSession(user);
      replacement = await this.issue(user);
      stored.replacedByTokenHash = hashRefreshToken(replacement);
      await stored.save();
      return { ...access, refreshToken: replacement };
    } catch (error) {
      if (access) {
        await TokenModel.deleteOne({ _id: access.token, ...getAccessTokenTypeFilter() });
      }
      if (replacement) {
        await this.revoke(replacement);
      }
      throw error;
    }
  }

  async revoke(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    await TokenModel.updateOne(
      {
        _id: hashRefreshToken(rawToken),
        tokenType: 'refresh',
        revokedAt: { $exists: false }
      },
      { $set: { revokedAt: new Date() } }
    );
  }

  private async createAccessSession(user: IUser): Promise<IssuedAccessSession> {
    const tokenId = new mongoose.Types.ObjectId();
    const payload: UserLoginPayload = {
      id: String(user._id),
      username: user.username,
      companyID: String(user.account_id)
    };
    const token = generateAccessToken(payload);
    const ttlSeconds = parseTtlSeconds(auth.expiresIn, 24 * 60 * 60);
    await TokenModel.create({
      _id: token,
      tokenType: 'access',
      token_id: tokenId,
      userId: user._id,
      principalType: 'user',
      ttl: ttlSeconds,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
    return { token, token_id: tokenId };
  }
}

export const refreshTokenService = new RefreshTokenService();

export const refreshTokenTestUtils = {
  hashRefreshToken
};
