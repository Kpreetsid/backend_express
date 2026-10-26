import catalogData from './asset-train-catalog.data.json';

export interface ComponentTemplate {
  key: string;
  name: string;
  asset_type: string;
  component_type: string;
  component_role: string;
  grouped: boolean;
  default_quantity: number;
}

export interface ComponentDefinition {
  value: string;
  label: string;
  role: string;
  aliases: string[];
}

export interface EquipmentDefinition {
  id: string;
  name: string;
  asset_type: string;
  train_type: string;
  source_train: string;
  components: ComponentTemplate[];
}

export interface AssetCreationOption {
  value: string;
  name: string;
  creationMode: 'standalone' | 'train';
  trainType: string;
}

export interface AssetTrainCatalog {
  schema_version: number;
  source: { file: string; sha256: string; row_count: number; resolved_duplicates: Array<{ name: string; retained: string; omitted: string }> };
  train_types: Array<{ value: string; label: string }>;
  legacy_asset_types: Array<{ value: string; name: string; train_type: string; selectable: boolean }>;
  component_types: ComponentDefinition[];
  equipment: EquipmentDefinition[];
  drive_components: Record<string, ComponentTemplate[]>;
}

// Generated from the same source in all three projects. Do not edit the JSON.
export const ASSET_TRAIN_CATALOG: AssetTrainCatalog = catalogData;

export function normalizeCatalogName(value: unknown): string {
  return String(value || '').trim().toLowerCase()
    .replace(/[\s/&+()-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function getEquipmentDefinition(value: unknown): EquipmentDefinition | undefined {
  const normalized = normalizeCatalogName(value);
  const direct = ASSET_TRAIN_CATALOG.equipment.find(item => item.id === normalized);
  if (direct) {
    return direct;
  }
  const legacy = ASSET_TRAIN_CATALOG.legacy_asset_types.find(
    item => normalizeCatalogName(item.value) === normalized
  );
  return legacy
    ? ASSET_TRAIN_CATALOG.equipment.find(item => item.id === normalizeCatalogName(legacy.name))
    : undefined;
}

export function getComponentDefinition(value: unknown): ComponentDefinition | undefined {
  const normalized = normalizeCatalogName(value);
  return ASSET_TRAIN_CATALOG.component_types.find(item =>
    [item.value, item.label, ...item.aliases].some(name => normalizeCatalogName(name) === normalized)
  );
}

export function getCatalogTrainType(value: unknown): string | undefined {
  const normalized = normalizeCatalogName(value);
  if (ASSET_TRAIN_CATALOG.train_types.some(item => item.value === normalized)) {
    return normalized;
  }
  const equipment = getEquipmentDefinition(value);
  if (equipment) {
    return equipment.train_type;
  }
  return ASSET_TRAIN_CATALOG.legacy_asset_types.find(
    item => normalizeCatalogName(item.value) === normalized || normalizeCatalogName(item.name) === normalized
  )?.train_type;
}

export function getAssetCreationOptions(): AssetCreationOption[] {
  const standalone = ASSET_TRAIN_CATALOG.legacy_asset_types
    .filter(item => item.selectable && !getEquipmentDefinition(item.value))
    .map(item => ({
      value: item.value, name: item.name,
      creationMode: 'standalone' as const, trainType: item.train_type
    }));
  const trains = ASSET_TRAIN_CATALOG.equipment.map(item => ({
    value: item.asset_type, name: item.name,
    creationMode: 'train' as const, trainType: item.train_type
  }));
  return [...standalone, ...trains];
}

/**
 * Return independent draft templates for Phase 2. Grouped entries stay as one
 * editable draft; no quantity is invented and no child assets are saved here.
 */
export function buildComponentTemplates(assetType: unknown, driveArrangement?: string): ComponentTemplate[] {
  const equipment = getEquipmentDefinition(assetType);
  if (!equipment) {
    return [];
  }
  const templates = equipment.components.map(item => ({ ...item }));
  const additions = ASSET_TRAIN_CATALOG.drive_components[driveArrangement || ''] || [];
  for (const addition of additions) {
    let exists = templates.some(item => item.key === addition.key);
    if (addition.component_type === 'coupling') {
      exists = templates.some(item =>
        ['coupling', 'flexible_coupling', 'rigid_coupling'].includes(item.component_type)
      );
    } else if (addition.component_type === 'gearbox' || addition.component_type === 'shaft') {
      exists = templates.some(item => item.component_type === addition.component_type);
    } else if (addition.component_type === 'belt_pulley') {
      // Retain differently named pulleys; only add enough to provide a pair.
      exists = exists || templates.filter(item => item.component_type === 'belt_pulley').length >= 2;
    }
    if (!exists) {
      templates.push({ ...addition });
    }
  }
  return templates;
}

export const SUPPORTED_ASSET_TYPES: string[] = Array.from(new Set([
  ...ASSET_TRAIN_CATALOG.legacy_asset_types.map(item => item.value),
  ...ASSET_TRAIN_CATALOG.equipment.map(item => item.asset_type),
  ...ASSET_TRAIN_CATALOG.component_types.flatMap(item => [item.label, ...item.aliases]),
  ...ASSET_TRAIN_CATALOG.equipment.flatMap(item => item.components.map(component => component.asset_type)),
]));
