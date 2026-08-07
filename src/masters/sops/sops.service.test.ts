import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOPsModel } from '../../models/sops.model';
import { sopsService } from './sops.service';

describe('SOP tenant write boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const sopId = '507f1f77bcf86cd799439013';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pins updates and strips client-owned tenant fields', async () => {
    const update = vi.spyOn(SOPsModel, 'findOneAndUpdate')
      .mockResolvedValue({ _id: sopId } as never);

    await sopsService.updateSOPs(sopId, {
      name: 'Lockout',
      locationId: '507f1f77bcf86cd799439014',
      categoryId: '507f1f77bcf86cd799439015',
      account_id: '507f1f77bcf86cd799439099',
      visible: false
    }, accountId, userId);

    expect(update).toHaveBeenCalledWith(
      { _id: sopId, account_id: accountId, visible: true },
      expect.objectContaining({ name: 'Lockout', updatedBy: userId })
    );
    const mutation = update.mock.calls[0]![1] as Record<string, unknown>;
    expect(mutation).not.toHaveProperty('account_id');
    expect(mutation).not.toHaveProperty('visible');
  });

  it('pins soft deletion to the authenticated account', async () => {
    const update = vi.spyOn(SOPsModel, 'findOneAndUpdate')
      .mockResolvedValue({ _id: sopId } as never);

    await sopsService.removeSOPs(sopId, accountId, userId);

    expect(update).toHaveBeenCalledWith(
      { _id: sopId, account_id: accountId, visible: true },
      { visible: false, updatedBy: userId },
      { returnDocument: 'after' }
    );
  });
});
