import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetModel } from '../models/asset.model';
import { CategoryModel } from '../models/formCategory.model';
import { LocationModel } from '../models/location.model';
import { requireTenantReferenceIds, requireTenantReferences } from './tenant-references';

const queryResult = (result: unknown) => {
  const query: any = Promise.resolve(result);
  query.session = vi.fn().mockReturnValue(query);
  return query;
};

describe('tenant reference boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const assetId = '507f1f77bcf86cd799439012';
  const locationId = '507f1f77bcf86cd799439013';
  const categoryId = '507f1f77bcf86cd799439014';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates every supplied reference inside the authenticated tenant', async () => {
    const assetExists = vi.spyOn(AssetModel, 'exists').mockReturnValue(queryResult({ _id: assetId }));
    const locationExists = vi.spyOn(LocationModel, 'exists').mockReturnValue(queryResult({ _id: locationId }));
    const categoryExists = vi.spyOn(CategoryModel, 'exists').mockReturnValue(queryResult({ _id: categoryId }));

    await requireTenantReferences(
      { assetId, locationId, categoryId },
      accountId
    );

    expect(assetExists).toHaveBeenCalledWith({
      _id: assetId,
      account_id: accountId,
      visible: true
    });
    expect(locationExists).toHaveBeenCalledWith({
      _id: locationId,
      account_id: accountId,
      visible: true
    });
    expect(categoryExists).toHaveBeenCalledWith({
      _id: categoryId,
      account_id: accountId,
      visible: true
    });
  });

  it('rejects a malformed identifier before querying a model', async () => {
    const assetExists = vi.spyOn(AssetModel, 'exists');

    await expect(requireTenantReferences(
      { assetId: 'not-an-object-id' },
      accountId
    )).rejects.toMatchObject({
      message: 'Invalid asset ID',
      status: 400
    });
    expect(assetExists).not.toHaveBeenCalled();
  });

  it('fails closed when a reference belongs to another tenant', async () => {
    vi.spyOn(LocationModel, 'exists').mockReturnValue(queryResult(null));

    await expect(requireTenantReferences(
      { locationId },
      accountId
    )).rejects.toMatchObject({
      message: 'Location not found',
      status: 404
    });
  });

  it('validates a distinct set of tenant-owned references', async () => {
    const countDocuments = vi.spyOn(AssetModel, 'countDocuments')
      .mockReturnValue(queryResult(2));

    await requireTenantReferenceIds({
      ids: [assetId, assetId, categoryId],
      accountId,
      label: 'Asset',
      model: AssetModel,
      match: { visible: true }
    });

    expect(countDocuments).toHaveBeenCalledWith({
      _id: { $in: [assetId, categoryId] },
      account_id: accountId,
      visible: true
    });
  });

  it('fails closed when any reference in a set is outside the tenant', async () => {
    vi.spyOn(LocationModel, 'countDocuments').mockReturnValue(queryResult(1));

    await expect(requireTenantReferenceIds({
      ids: [locationId, categoryId],
      accountId,
      label: 'Location',
      model: LocationModel
    })).rejects.toMatchObject({
      message: 'Location not found',
      status: 404
    });
  });
});
