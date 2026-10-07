import { Types } from 'mongoose';
import { getComponentDefinition } from '../../catalog/asset-train-catalog';

/** Manual additions create one direct child and never regenerate a train. */
export function buildChildComponent(root: any, body: any, accountId: any, userId: any, mappings: any[]) {
  if (!root || String(root.account_id) !== String(accountId) || root.visible === false
    || root.top_level !== true || root.parent_id) {
    throw Object.assign(new Error('Select a top-level asset in your account.'), { status: 400 });
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const definition = typeof body?.asset_type === 'string' ? getComponentDefinition(body.asset_type) : undefined;
  if (!name || name.length > 200 || !definition) {
    throw Object.assign(new Error('Provide a component name of 1–200 characters and a supported component type.'), { status: 400 });
  }
  const id = new Types.ObjectId();
  const asset = {
    _id: id, asset_name: name, asset_type: definition.label,
    account_id: accountId, createdBy: userId, updatedBy: userId,
    top_level: false, parent_id: root._id, top_level_asset_id: root._id, visible: true,
    locationId: root.locationId, asset_class: root.asset_class || 'class_1',
    asset_timezone: root.asset_timezone, alarmType: [...(root.alarmType || [])],
    snoozeAlarm: root.snoozeAlarm || false, snoozeValue: root.snoozeValue || 0,
    asset_build_type: ['motor', 'generator', 'alternator'].includes(definition.value) ? 'electric' : 'non_electric',
    asset_id: '', manufacturer: '', asset_model: '', year: '', description: '', images: [],
    diagnostic_component_key: `component_${id}`,
    diagnostic_component_type: definition.value, diagnostic_component_role: definition.role
  };
  const users = new Map(mappings.filter(row => row.userId).map(row => [String(row.userId), row]));
  const childMappings = [...users.values()].map(row => ({
    account_id: accountId, assetId: id, userId: row.userId,
    alert: !!row.alert, danger: !!row.danger, critical: !!row.critical, sendMail: !!row.sendMail
  }));
  return { asset, mappings: childMappings };
}

export function componentIdentityForUpdate(existing: any, body: any) {
  if (!existing.diagnostic_component_key) return body;
  const definition = getComponentDefinition(body.asset_type || existing.asset_type);
  if (!definition) throw Object.assign(new Error('Select a supported component type.'), { status: 400 });
  return { ...body, account_id: existing.account_id,
    parent_id: existing.parent_id, top_level_asset_id: existing.top_level_asset_id, top_level: false,
    diagnostic_component_key: existing.diagnostic_component_key,
    diagnostic_component_type: definition.value, diagnostic_component_role: definition.role };
}

/** Only the explicitly confirmed leaf component is hidden after SQL deletion. */
export async function deleteConfirmedChild(childId: string, deps: {
  deleteEndpoints(): Promise<any>;
  hideChild(): Promise<void>;
}) {
  const result = await deps.deleteEndpoints();
  if (result?.status !== true || result?.data?.asset_id !== childId) {
    throw Object.assign(new Error('Endpoint deletion was not confirmed. The component remains available; please retry.'), { status: 502 });
  }
  await deps.hideChild();
  return result.data;
}
