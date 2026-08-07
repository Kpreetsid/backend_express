import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instructionController } from './instruction.controller';
import { instructionService } from './instruction.service';
import { applyRoleFilter } from '../../utils/roleFilter';
import { requireTenantReferences } from '../../utils/tenant-references';

vi.mock('./instruction.service', () => ({
  instructionService: {
    getInstructions: vi.fn(),
    createInstructions: vi.fn(),
    updateInstructions: vi.fn(),
    deleteInstructionsById: vi.fn()
  }
}));
vi.mock('../../utils/roleFilter', () => ({ applyRoleFilter: vi.fn() }));
vi.mock('../../utils/tenant-references', () => ({ requireTenantReferences: vi.fn() }));

describe('work-instruction controller tenant boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const assetId = '507f1f77bcf86cd799439013';

  const response = () => {
    const value: any = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
    value.status.mockReturnValue(value);
    return value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyRoleFilter).mockImplementation(async ({ baseFilter }: any) => ({
      ...baseFilter,
      account_id: accountId,
      visible: true
    }));
    vi.mocked(instructionService.getInstructions).mockResolvedValue([{}] as never);
    vi.mocked(instructionService.createInstructions).mockResolvedValue({} as never);
  });

  it('applies the asset mapping scope to an asset-filtered list', async () => {
    const res = response();
    const next = vi.fn();

    await instructionController.getAll({
      user: { account_id: accountId, _id: userId, user_role: 'manager' },
      query: { assetId }
    } as any, res, next);

    expect(applyRoleFilter).toHaveBeenCalledWith(expect.objectContaining({
      baseFilter: { assetId: expect.objectContaining({}) },
      mapping: 'asset',
      idField: 'assetId'
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a foreign reference before creating an instruction', async () => {
    const failure = Object.assign(new Error('Asset not found'), { status: 404 });
    vi.mocked(requireTenantReferences).mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();
    const body = { title: 'Isolate power', assetId, WI_steps: [] };

    await instructionController.create({
      user: { account_id: accountId, _id: userId },
      body
    } as any, res, next);

    expect(requireTenantReferences).toHaveBeenCalledWith(body, accountId);
    expect(instructionService.createInstructions).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(failure);
  });
});
