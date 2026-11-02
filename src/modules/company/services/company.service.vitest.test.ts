import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountApiKeyModel } from '../models/accountApiKey.model';
import { AccountModel } from '../models/account.model';
import { companyService } from './company.service';

const accountId = new mongoose.Types.ObjectId();
const account = { _id: accountId, account_name: 'Test Company' };

describe('CompanyService account API keys', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the latest API-key state for an account', async () => {
    vi.spyOn(AccountModel, 'findById').mockResolvedValue(account as any);
    const sort = vi.fn().mockResolvedValue({
      download_api_key: 'existing-key',
      type: 'download_api_key',
      visible: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });
    vi.spyOn(AccountApiKeyModel, 'findOne').mockReturnValue({ sort } as any);

    const result = await companyService.getAccountApiKey(String(accountId));

    expect(result).toMatchObject({
      account_name: 'Test Company',
      api_key: 'existing-key',
      download_api_key: 'existing-key',
      visible: true,
      is_active: true
    });
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1, createdAt: -1 });
  });

  it('generates and upserts a cryptographically random active key', async () => {
    vi.spyOn(AccountModel, 'findById').mockResolvedValue(account as any);
    const findOneAndUpdate = vi.spyOn(AccountApiKeyModel, 'findOneAndUpdate').mockResolvedValue({
      type: 'download_api_key',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01')
    } as any);

    const result = await companyService.generateAccountApiKey(String(accountId));

    expect(result.download_api_key).toMatch(/^[A-Za-z0-9_-]{48}$/);
    expect(result).toMatchObject({ visible: true, is_active: true });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { account_id: accountId },
      { $set: expect.objectContaining({
        download_api_key: result.download_api_key,
        type: 'download_api_key',
        visible: true
      }) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  });

  it('toggles and persists an existing API key when no explicit state is supplied', async () => {
    vi.spyOn(AccountModel, 'findById').mockResolvedValue(account as any);
    const save = vi.fn().mockResolvedValue(undefined);
    const keyDocument = {
      download_api_key: 'existing-key',
      type: 'download_api_key',
      visible: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      save
    };
    vi.spyOn(AccountApiKeyModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockResolvedValue(keyDocument)
    } as any);

    const result = await companyService.toggleAccountApiKeyStatus(String(accountId));

    expect(keyDocument.visible).toBe(false);
    expect(save).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ visible: false, is_active: false });
  });

  it('rejects API-key generation for an unknown account', async () => {
    vi.spyOn(AccountModel, 'findById').mockResolvedValue(null);

    await expect(companyService.generateAccountApiKey(String(accountId))).rejects.toMatchObject({
      message: 'Account not found',
      status: 404
    });
  });
});
