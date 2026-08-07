import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountModel } from '../../models/account.model';
import { companyService } from './company.service';

vi.mock('../../models/account.model', () => ({
  AccountModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn()
  }
}));

describe('company tenant boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects deletion of an account other than the authenticated account', async () => {
    await expect(
      companyService.removeById('tenant-b', 'user-a', 'tenant-a')
    ).rejects.toMatchObject({ status: 400, message: 'Invalid account ID' });

    expect(AccountModel.findOne).not.toHaveBeenCalled();
  });

  it('pins soft deletion to the authenticated account', async () => {
    vi.mocked(AccountModel.findOne).mockResolvedValue({
      visible: true,
      account_status: 'active'
    } as never);
    vi.mocked(AccountModel.findOneAndUpdate).mockResolvedValue({} as never);

    await expect(
      companyService.removeById('tenant-a', 'user-a', 'tenant-a')
    ).resolves.toBe(true);

    const match = {
      _id: 'tenant-a',
      visible: true,
      account_status: { $ne: 'inactive' }
    };
    expect(AccountModel.findOne).toHaveBeenCalledWith(match);
    expect(AccountModel.findOneAndUpdate).toHaveBeenCalledWith(
      match,
      {
        visible: false,
        account_status: 'inactive',
        updated_by: 'user-a'
      },
      { returnDocument: 'after' }
    );
  });
});
