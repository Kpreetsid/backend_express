import { ClientSession, Model, Types } from 'mongoose';
import { AssetModel } from '../models/asset.model';
import { CategoryModel } from '../models/formCategory.model';
import { LocationModel } from '../models/location.model';

type TenantReferenceKey = 'assetId' | 'locationId' | 'categoryId';

interface TenantReferenceDefinition {
  label: string;
  model: Model<any>;
}

interface TenantReferenceSet {
  ids: readonly unknown[];
  accountId: unknown;
  label: string;
  model: Model<any>;
  match?: Record<string, unknown>;
  session?: ClientSession;
}

const TENANT_REFERENCE_MODELS: Readonly<
  Record<TenantReferenceKey, TenantReferenceDefinition>
> = Object.freeze({
  assetId: { label: 'Asset', model: AssetModel },
  locationId: { label: 'Location', model: LocationModel },
  categoryId: { label: 'Category', model: CategoryModel }
});

export const requireTenantReferences = async (
  references: Partial<Record<TenantReferenceKey, unknown>>,
  accountId: unknown,
  session?: ClientSession
): Promise<void> => {
  for (const [key, definition] of Object.entries(TENANT_REFERENCE_MODELS) as
    [TenantReferenceKey, TenantReferenceDefinition][]) {
    const value = references[key];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (!Types.ObjectId.isValid(String(value))) {
      throw Object.assign(new Error(`Invalid ${definition.label.toLowerCase()} ID`), {
        status: 400
      });
    }
    const query = definition.model.exists({
      _id: value,
      account_id: accountId,
      visible: true
    });
    if (session) {
      query.session(session);
    }
    if (!await query) {
      throw Object.assign(new Error(`${definition.label} not found`), {
        status: 404
      });
    }
  }
};

export const requireTenantReferenceIds = async ({
  ids,
  accountId,
  label,
  model,
  match = { visible: true },
  session
}: TenantReferenceSet): Promise<void> => {
  const normalizedIds = [...new Set(
    ids
      .filter((value) => value !== undefined && value !== null && value !== '')
      .map((value) => String(value))
  )];
  if (!normalizedIds.length) {
    return;
  }
  if (normalizedIds.some((value) => !Types.ObjectId.isValid(value))) {
    throw Object.assign(new Error(`Invalid ${label.toLowerCase()} ID`), {
      status: 400
    });
  }

  const query = model.countDocuments({
    _id: { $in: normalizedIds },
    account_id: accountId,
    ...match
  });
  if (session) {
    query.session(session);
  }
  if (await query !== normalizedIds.length) {
    throw Object.assign(new Error(`${label} not found`), { status: 404 });
  }
};
