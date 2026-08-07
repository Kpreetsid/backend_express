import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TroubleshootGuideModel } from '../../models/troubleshootGuide.model';
import { troubleshootGuideService } from './troubleshoot-guide.service';

describe('troubleshooting-guide tenant write boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const guideId = '507f1f77bcf86cd799439013';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pins updates and strips client-owned fields', async () => {
    const update = vi.spyOn(TroubleshootGuideModel, 'findOneAndUpdate')
      .mockResolvedValue({ _id: guideId } as never);

    await troubleshootGuideService.updateTroubleshootGuideById(guideId, {
      title: 'Bearing noise',
      troubleshooting_steps: [],
      account_id: '507f1f77bcf86cd799439099',
      visible: false
    }, accountId, userId);

    expect(update).toHaveBeenCalledWith(
      { _id: guideId, account_id: accountId, visible: true },
      expect.objectContaining({
        title: 'Bearing noise',
        updatedBy: userId
      }),
      { returnDocument: 'after' }
    );
    const mutation = update.mock.calls[0]![1] as Record<string, unknown>;
    expect(mutation).not.toHaveProperty('account_id');
    expect(mutation).not.toHaveProperty('visible');
  });

  it('pins soft deletion to the authenticated account', async () => {
    const update = vi.spyOn(TroubleshootGuideModel, 'findOneAndUpdate')
      .mockResolvedValue({ _id: guideId } as never);

    await troubleshootGuideService.removeTroubleshootGuideById(
      guideId,
      accountId,
      userId
    );

    expect(update).toHaveBeenCalledWith(
      { _id: guideId, account_id: accountId, visible: true },
      { visible: false, updatedBy: userId },
      { returnDocument: 'after' }
    );
  });
});
