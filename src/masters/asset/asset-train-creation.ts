import { Types } from 'mongoose';
import { getComponentDefinition, getEquipmentDefinition } from '../../catalog/asset-train-catalog';

// Django's train inventory allows 2,000 assets, including the parent.
export const MAX_CREATED_COMPONENTS = 1999;

export interface ReviewedComponent {
  key: string;
  name: string;
  asset_type: string;
  component_type: string;
  component_role: string;
}

export interface AssetTrainCreationPlan {
  assets: any[];
  mappings: any[];
  components: Array<ReviewedComponent & { asset_id: string }>;
}

function invalid(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

export function validateReviewedComponents(body: any): ReviewedComponent[] {
  if (body?.top_level !== true || body?.parent_id) {
    invalid('Automatic components can only be created under a new top-level asset.');
  }
  if (typeof body?.asset_type !== 'string' || !getEquipmentDefinition(body.asset_type)) {
    invalid('Select a catalog equipment type to create an asset train.');
  }
  if (!Array.isArray(body.components) || body.components.length > MAX_CREATED_COMPONENTS) {
    invalid(`components must be an array of up to ${MAX_CREATED_COMPONENTS} reviewed children.`);
  }
  const keys = new Set<string>();
  const names = new Set<string>();
  return body.components.map((item: any) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      invalid('Each component must be an object.');
    }
    const key = typeof item.key === 'string' ? item.key.trim() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,149}$/.test(key) || keys.has(key)) {
      invalid('Component keys must be unique identifiers of up to 150 characters.');
    }
    if (!name || name.length > 200 || names.has(name.toLowerCase())) {
      invalid('Component names must be unique and contain 1–200 characters.');
    }
    const definition = typeof item.asset_type === 'string' ? getComponentDefinition(item.asset_type) : undefined;
    if (!definition || definition.value !== item.component_type || definition.role !== item.component_role) {
      invalid(`Invalid component asset type, diagnostic type or role for ${name}.`);
    }
    keys.add(key);
    names.add(name.toLowerCase());
    return { key, name, asset_type: item.asset_type.trim(), component_type: definition.value, component_role: definition.role };
  });
}

export function buildAssetTrainCreationPlan(body: any, accountId: any, userId: any): AssetTrainCreationPlan {
  const reviewed = validateReviewedComponents(body);
  if (typeof body.locationId !== 'string' || !/^[a-f\d]{24}$/i.test(body.locationId)) {
    invalid('Select a valid location.');
  }
  if (typeof body.asset_timezone !== 'string' || !body.asset_timezone.trim()) {
    invalid('Select a valid asset timezone.');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: body.asset_timezone.trim() });
  } catch {
    invalid('Select a valid asset timezone.');
  }
  if (body.asset_class && !['class_1', 'class_2', 'class_3', 'class_4'].includes(body.asset_class)) {
    invalid('Select a valid asset class.');
  }
  if (typeof body.asset_name !== 'string' || !body.asset_name.trim() || body.asset_name.trim().length > 200) {
    invalid('Asset name must contain 1–200 characters.');
  }
  if (!Array.isArray(body.userIdList) || !body.userIdList.length
    || body.userIdList.some((id: any) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
    invalid('Select at least one valid user.');
  }
  if (!Array.isArray(body.alarmType) || !body.alarmType.length || body.alarmType.some((type: any) =>
    !['alert', 'danger', 'critical', 'sendMail'].includes(type))) {
    invalid('Invalid alarm types.');
  }
  const rootId = new Types.ObjectId();
  const { components: _components, ...rootBody } = body;
  const root = {
    ...rootBody, _id: rootId, account_id: accountId, createdBy: userId, updatedBy: userId,
    asset_name: body.asset_name.trim(), asset_type: getEquipmentDefinition(body.asset_type)!.asset_type,
    asset_class: body.asset_class || 'class_1',
    top_level: true, parent_id: null, top_level_asset_id: rootId, visible: true
  };
  const children = reviewed.map(component => ({
    _id: new Types.ObjectId(), account_id: accountId, createdBy: userId, updatedBy: userId,
    asset_name: component.name, asset_type: component.asset_type,
    parent_id: rootId, top_level_asset_id: rootId, top_level: false, visible: true,
    locationId: root.locationId, asset_class: root.asset_class || 'class_1',
    asset_timezone: root.asset_timezone,
    asset_build_type: ['motor', 'generator', 'alternator'].includes(component.component_type) ? 'electric' : 'non_electric',
    alarmType: [...body.alarmType], snoozeAlarm: root.snoozeAlarm || false, snoozeValue: root.snoozeValue || 0,
    asset_id: '', manufacturer: '', asset_model: '', year: '', description: '', images: [],
    diagnostic_component_key: component.key,
    diagnostic_component_type: component.component_type,
    diagnostic_component_role: component.component_role
  }));
  const assets = [root, ...children];
  const users = [...new Set<string>(body.userIdList)];
  const mappings = assets.flatMap(asset => users.map(mappedUserId => ({
    account_id: accountId, assetId: asset._id, userId: mappedUserId,
    alert: body.alarmType.includes('alert'), danger: body.alarmType.includes('danger'),
    critical: body.alarmType.includes('critical'), sendMail: body.alarmType.includes('sendMail')
  })));
  return {
    assets, mappings,
    components: reviewed.map((component, index) => ({ ...component, asset_id: String(children[index]._id) }))
  };
}

export interface AssetTrainCreationDependencies {
  preflight(plan: AssetTrainCreationPlan): Promise<void>;
  persist(plan: AssetTrainCreationPlan): Promise<void>;
  initializeHealth(plan: AssetTrainCreationPlan): Promise<void>;
  readRoot(rootId: string): Promise<any[]>;
  rollback(ids: string[]): Promise<void>;
}

/** Mongo commit precedes the processor call; explicit IDs also cover standalone Mongo deployments. */
export async function createReviewedAssetTrain(
  body: any, accountId: any, userId: any, deps: AssetTrainCreationDependencies
): Promise<{ data: any[]; components: AssetTrainCreationPlan['components'] }> {
  const plan = buildAssetTrainCreationPlan(body, accountId, userId);
  await deps.preflight(plan);
  try {
    await deps.persist(plan);
    await deps.initializeHealth(plan);
    const data = await deps.readRoot(String(plan.assets[0]._id));
    if (!data.length) {
      throw new Error('The created asset train could not be loaded.');
    }
    return { data, components: plan.components };
  } catch (error) {
    try {
      await deps.rollback(plan.assets.map(asset => String(asset._id)));
    } catch (cleanupError) {
      throw Object.assign(new AggregateError([error, cleanupError], 'Asset train creation failed and its cleanup could not be completed.'), { status: 500 });
    }
    throw error;
  }
}
