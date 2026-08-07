import { describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { applyDeclaredModelIndexes } from './20260730-declared-model-indexes';

const fakeModel = (
  modelName: string,
  collectionName: string,
  indexes: string[] | Error
) => ({
  modelName,
  collection: { collectionName },
  schema: {
    indexes: vi.fn(() => indexes instanceof Error ? [] : indexes)
  },
  createIndexes: indexes instanceof Error
    ? vi.fn().mockRejectedValue(indexes)
    : vi.fn().mockResolvedValue(undefined)
});

describe('declared production index migration', () => {
  it('discovers every registered model in deterministic order by default', async () => {
    const account = fakeModel('Schema_Account', 'account_master', []);
    const user = fakeModel('Schema_User', 'users', []);
    vi.spyOn(mongoose, 'modelNames').mockReturnValue([
      'Schema_User',
      'Schema_Account'
    ]);
    const modelSpy = vi.spyOn(mongoose, 'model').mockImplementation(
      ((modelName: string) => modelName === 'Schema_Account' ? account : user) as any
    );

    const results = await applyDeclaredModelIndexes();

    expect(modelSpy.mock.calls.map(([modelName]) => modelName)).toEqual([
      'Schema_Account',
      'Schema_User'
    ]);
    expect(results.map(({ model }) => model)).toEqual([
      'Schema_Account',
      'Schema_User'
    ]);
  });

  it('creates every registered model index without dropping indexes', async () => {
    const account = fakeModel(
      'Schema_Account',
      'account_master',
      ['account_name_1']
    );
    const user = fakeModel(
      'Schema_User',
      'users',
      ['account_id_1_user_status_1', 'email_1']
    );

    await expect(applyDeclaredModelIndexes(
      [account, user] as never
    )).resolves.toEqual([
      {
        model: 'Schema_Account',
        collection: 'account_master',
        indexCount: 1
      },
      {
        model: 'Schema_User',
        collection: 'users',
        indexCount: 2
      }
    ]);
    expect(account.createIndexes).toHaveBeenCalledOnce();
    expect(user.createIndexes).toHaveBeenCalledOnce();
  });

  it('fails closed with the exact model that could not create indexes', async () => {
    const failing = fakeModel(
      'Schema_WorkOrder',
      'work_order',
      new Error('conflicting index')
    );

    await expect(applyDeclaredModelIndexes(
      [failing] as never
    )).rejects.toMatchObject({
      message: 'Declared index migration failed for Schema_WorkOrder',
      model: 'Schema_WorkOrder'
    });
  });
});
