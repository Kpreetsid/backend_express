import { Request } from 'express';
import { redisConfig } from '../src/configDB';
import { SettingsModel } from '../src/models/settings.model';
import { canUseRedisForRequest, redisStatusService } from '../src/settings/redisStatus.service';
import { isRedisReady } from '../src/_config/redis';

jest.mock('../src/_config/redis', () => ({
  isRedisReady: jest.fn()
}));

const mockSettingsLookup = (value: { redis_status?: string } | null): void => {
  jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value)
    })
  } as any);
};

const buildRequest = (accountId: string): Request => ({
  headers: { accountid: accountId }
}) as Request;

describe('redisStatusService', () => {
  const originalEnabled = redisConfig.enabled;

  beforeEach(() => {
    redisStatusService.clear();
    redisConfig.enabled = true;
    (isRedisReady as jest.Mock).mockReturnValue(true);
  });

  afterAll(() => {
    redisConfig.enabled = originalEnabled;
  });

  it('bypasses Redis when REDIS_ENABLED is false', async () => {
    redisConfig.enabled = false;
    const findOneSpy = jest.spyOn(SettingsModel, 'findOne');

    await expect(canUseRedisForRequest(buildRequest('account-1'))).resolves.toBe(false);
    expect(findOneSpy).not.toHaveBeenCalled();
  });

  it('uses Redis when global flag, client readiness, and redis_status are enabled', async () => {
    mockSettingsLookup({ redis_status: 'enabled' });

    await expect(canUseRedisForRequest(buildRequest('account-1'))).resolves.toBe(true);
  });

  it('bypasses Redis when redis_status is disabled', async () => {
    mockSettingsLookup({ redis_status: 'disabled' });

    await expect(canUseRedisForRequest(buildRequest('account-1'))).resolves.toBe(false);
  });

  it('bypasses Redis when settings are missing', async () => {
    mockSettingsLookup(null);

    await expect(canUseRedisForRequest(buildRequest('account-1'))).resolves.toBe(false);
  });

  it('bypasses Redis when the settings lookup fails', async () => {
    jest.spyOn(SettingsModel, 'findOne').mockImplementation(() => {
      throw new Error('database unavailable');
    });

    await expect(canUseRedisForRequest(buildRequest('account-1'))).resolves.toBe(false);
  });
});
