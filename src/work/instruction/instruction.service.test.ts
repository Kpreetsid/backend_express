import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkInstructions } from '../../models/workInstructions.model';
import { instructionService } from './instruction.service';

describe('work-instruction tenant write boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const instructionId = '507f1f77bcf86cd799439013';
  const assetId = '507f1f77bcf86cd799439014';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves the authenticated ownership fields on create', async () => {
    const save = vi.spyOn(WorkInstructions.prototype, 'save')
      .mockResolvedValue({ _id: instructionId } as never);

    await instructionService.createInstructions({
      title: 'Isolate power',
      WI_steps: [],
      assetId,
      account_id: '507f1f77bcf86cd799439099',
      createdBy: '507f1f77bcf86cd799439098',
      visible: false
    }, accountId, userId);

    const document: any = save.mock.instances[0];
    expect(String(document.account_id)).toBe(accountId);
    expect(String(document.createdBy)).toBe(userId);
    expect(document.visible).toBe(true);
    expect(String(document.assetId)).toBe(assetId);
  });

  it('pins updates to the authenticated account and strips protected fields', async () => {
    const update = vi.spyOn(WorkInstructions, 'findOneAndUpdate')
      .mockResolvedValue({ _id: instructionId } as never);

    await instructionService.updateInstructions(instructionId, {
      title: 'Updated',
      account_id: '507f1f77bcf86cd799439099',
      createdBy: '507f1f77bcf86cd799439098',
      visible: false
    }, accountId, userId);

    expect(update).toHaveBeenCalledWith(
      { _id: instructionId, account_id: accountId, visible: true },
      expect.objectContaining({
        title: 'Updated',
        updatedBy: userId
      }),
      { returnDocument: 'after' }
    );
    const mutation = update.mock.calls[0]![1] as Record<string, unknown>;
    expect(mutation).not.toHaveProperty('account_id');
    expect(mutation).not.toHaveProperty('createdBy');
    expect(mutation).not.toHaveProperty('visible');
  });

  it('pins soft deletion to the authenticated account', async () => {
    const update = vi.spyOn(WorkInstructions, 'findOneAndUpdate')
      .mockResolvedValue({ _id: instructionId } as never);

    await instructionService.deleteInstructionsById(
      instructionId,
      accountId,
      userId
    );

    expect(update).toHaveBeenCalledWith(
      { _id: instructionId, account_id: accountId, visible: true },
      { updatedBy: userId, visible: false },
      { returnDocument: 'after' }
    );
  });
});
